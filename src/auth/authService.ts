import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../users/userService.js';
import { DatabaseService } from '../db/databaseService.js';
import { jwtConstants } from './constants.js';
import { RegisterDto } from './dto/registerDto.js';
import { LoginDto } from './dto/loginDto.js';
import { VerificationStatus, UserRole } from '../models/Enums.js';
import type { PublicUser, User } from '../models/User.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly db: DatabaseService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: PublicUser; accessToken: string; refreshToken: string }> {
    const existing = await this.userService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const role = (dto.role as any) || UserRole.Tenant;

    const user = await this.userService.createUser({
      name: dto.name,
      email: dto.email,
      phoneNumber: dto.phoneNumber ?? null,
      passwordHash,
      role: role as any,
      kycStatus: VerificationStatus.Pending,
    });

    const { accessToken, refreshToken } = await this.issueTokens(user);
    return { user: this.userService.toPublicUser(user), accessToken, refreshToken };
  }

  async login(dto: LoginDto): Promise<{ user: PublicUser; accessToken: string; refreshToken: string }> {
    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { accessToken, refreshToken } = await this.issueTokens(user);
    return { user: this.userService.toPublicUser(user), accessToken, refreshToken };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, { secret: jwtConstants.refreshSecret });
      const user = await this.userService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException();
      }
      const tokens = await this.issueTokens(user);
      await this.revokeRefreshTokensForUser(user.userId);
      await this.storeRefreshToken(user.userId, tokens.refreshToken);
      return tokens;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async findUserById(userId: string): Promise<User | null> {
    return this.userService.findById(userId);
  }

  async findOrCreateGoogleUser(profile: { email?: string; name: string; providerId: string }): Promise<User> {
    if (!profile.email) {
      throw new UnauthorizedException('Google account must have an email');
    }

    const existingByProvider = await this.db.query(
      `SELECT user_id, name, email, phone_number, password_hash, role, kyc_status, created_at, updated_at, provider, provider_id
       FROM public.users
       WHERE provider = 'google' AND provider_id = $1`,
      [profile.providerId],
    );

    if (existingByProvider.rows[0]) {
      return existingByProvider.rows[0] as User;
    }

    const existingByEmail = await this.userService.findByEmail(profile.email);
    if (existingByEmail) {
      if (existingByEmail.role === 'admin') {
        throw new UnauthorizedException('Account already exists');
      }
      const linked = await this.db.query(
        `UPDATE public.users
         SET provider = 'google', provider_id = $2
         WHERE user_id = $1
         RETURNING user_id, name, email, phone_number, password_hash, role, kyc_status, created_at, updated_at`,
        [existingByEmail.userId, profile.providerId],
      );
      return (linked.rows[0] as User) || existingByEmail;
    }

    const result = await this.db.query(
      `INSERT INTO public.users (name, email, password_hash, role, kyc_status, provider, provider_id)
       VALUES ($1, $2, NULL, $3, $4, 'google', $5)
       RETURNING user_id, name, email, phone_number, password_hash, role, kyc_status, created_at, updated_at`,
      [profile.name, profile.email, UserRole.Tenant, VerificationStatus.Pending, profile.providerId],
    );

    return result.rows[0] as User;
  }

  async loginGoogleUser(user: User): Promise<{ user: PublicUser; accessToken: string; refreshToken: string }> {
    const { accessToken, refreshToken } = await this.issueTokens(user);
    return { user: this.userService.toPublicUser(user), accessToken, refreshToken };
  }

  private async issueTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const userId = (user as any).userId || (user as any).user_id;
    const payload = { sub: userId, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload, {
      secret: jwtConstants.accessSecret,
      expiresIn: jwtConstants.accessExpiresIn as any,
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: jwtConstants.refreshSecret,
      expiresIn: jwtConstants.refreshExpiresIn as any,
    });
    await this.revokeRefreshTokensForUser(userId);
    await this.storeRefreshToken(userId, refreshToken);
    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, token: string): Promise<void> {
    const tokenHash = await bcrypt.hash(token, 10);
    const familyId = this.generateUuid();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.db.query(
      `INSERT INTO public.refresh_tokens (user_id, token_hash, family_id, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, tokenHash, familyId, expiresAt],
    );
  }

  private async revokeRefreshTokensForUser(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE public.refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
  }

  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
