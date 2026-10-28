import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { UserService } from '../users/userService.js';
import { DatabaseService } from '../db/databaseService.js';
import { jwtConstants } from './constants.js';
import { RegisterDto } from './dto/registerDto.js';
import { LoginDto } from './dto/loginDto.js';
import { VerificationStatus, UserRole } from '../models/Enums.js';
import type { PublicUser, User } from '../models/User.js';
import { EmailService } from '../email/emailService.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly db: DatabaseService,
    private readonly emailService: EmailService,
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
    if (!user || !user.passwordHash) {
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

  async requestPasswordReset(email: string): Promise<{ message: string; resetToken?: string }> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      return { message: 'If an account with that email exists, a password reset link has been sent' };
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const userId = (user as any).userId || (user as any).user_id;
    await this.db.query(
      `INSERT INTO public.password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt],
    );

    try {
      await this.emailService.sendPasswordResetEmail(user.email, token);
    } catch (err) {
      console.error('[AuthService] Failed to send reset email:', err);
    }

    if (process.env.NODE_ENV !== 'production') {
      return { message: 'If an account with that email exists, a password reset link has been sent', resetToken: token };
    }

    return { message: 'If an account with that email exists, a password reset link has been sent' };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    if (!token || !newPassword) {
      throw new UnauthorizedException('Invalid or expired password reset token');
    }
    const result = await this.db.query(
      `SELECT token_id, user_id, token_hash, expires_at, used_at
       FROM public.password_reset_tokens
       WHERE expires_at > now() AND used_at IS NULL`,
      [],
    );

    let tokenRecord: any = null;
    for (const row of result.rows) {
      try {
        const valid = await bcrypt.compare(token, row.token_hash);
        if (valid) {
          tokenRecord = row;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid or expired password reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const userId = tokenRecord.user_id;
    await this.db.query(
      `UPDATE public.users SET password_hash = $1, updated_at = now() WHERE user_id = $2`,
      [passwordHash, userId],
    );
    await this.db.query(
      `UPDATE public.password_reset_tokens SET used_at = now() WHERE token_id = $1`,
      [tokenRecord.token_id],
    );
    await this.revokeRefreshTokensForUser(userId);

    return { message: 'Password has been reset successfully' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (!user.passwordHash) {
      throw new UnauthorizedException('Cannot change password for accounts without a password');
    }
    if (!currentPassword || !newPassword) {
      throw new UnauthorizedException('Current password and new password are required');
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.db.query(
      `UPDATE public.users SET password_hash = $1, updated_at = now() WHERE user_id = $2`,
      [passwordHash, userId],
    );
    await this.revokeRefreshTokensForUser(userId);

    return { message: 'Password has been changed successfully' };
  }

  async setPassword(userId: string, newPassword: string, confirmPassword: string): Promise<{ message: string }> {
    if (!newPassword || !confirmPassword) {
      throw new UnauthorizedException('New password and confirm password are required');
    }
    if (newPassword !== confirmPassword) {
      throw new UnauthorizedException('Passwords do not match');
    }
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (user.passwordHash) {
      throw new UnauthorizedException('Password already exists. Use change-password instead.');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.db.query(
      `UPDATE public.users SET password_hash = $1, updated_at = now() WHERE user_id = $2`,
      [passwordHash, userId],
    );
    await this.revokeRefreshTokensForUser(userId);
    return { message: 'Password has been set successfully' };
  }

  async adminLogin(email: string, password: string): Promise<{ user: PublicUser; accessToken: string; refreshToken: string }> {
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmails.includes((email || '').toLowerCase())) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (adminPassword && password !== adminPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { accessToken, refreshToken } = await this.issueTokens(user);
    return { user: this.userService.toPublicUser(user), accessToken, refreshToken };
  }

  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
