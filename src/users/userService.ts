import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../db/databaseService.js';
import type { PublicUser, User } from '../models/User.js';
import type { StoredUserRole, VerificationStatus } from '../models/Enums.js';

function mapUser(row: any): User {
  if (!row) return row;
  return {
    userId: row.user_id || row.userId,
    name: row.name,
    email: row.email,
    phoneNumber: row.phone_number ?? row.phoneNumber ?? null,
    passwordHash: row.password_hash ?? row.passwordHash ?? null,
    role: row.role,
    kycStatus: row.kyc_status ?? row.kycStatus,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  } as User;
}

@Injectable()
export class UserService {
  constructor(private readonly db: DatabaseService) {}

  async createUser(params: {
    name: string;
    email: string;
    phoneNumber?: string | null;
    passwordHash: string | null;
    role: StoredUserRole;
    kycStatus: VerificationStatus;
  }): Promise<User> {
    const result = await this.db.query(
      `INSERT INTO public.users (name, email, phone_number, password_hash, role, kyc_status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING user_id, name, email, phone_number, password_hash, role, kyc_status, created_at, updated_at`,
      [
        params.name,
        params.email,
        params.phoneNumber ?? null,
        params.passwordHash,
        params.role,
        params.kycStatus,
      ],
    );
    return mapUser(result.rows[0]) as User;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db.query(
      `SELECT user_id, name, email, phone_number, password_hash, role, kyc_status, created_at, updated_at
       FROM public.users
       WHERE lower(email) = lower($1)`,
      [email],
    );
    return result.rows[0] ? (mapUser(result.rows[0]) as User) : null;
  }

  async findById(userId: string): Promise<User | null> {
    const result = await this.db.query(
      `SELECT user_id, name, email, phone_number, password_hash, role, kyc_status, created_at, updated_at
       FROM public.users
       WHERE user_id = $1`,
      [userId],
    );
    return result.rows[0] ? (mapUser(result.rows[0]) as User) : null;
  }

  toPublicUser(user: User): PublicUser {
    if (!user) return user;
    const { passwordHash: _passwordHash, ...publicUser } = user as any;
    return publicUser as PublicUser;
  }
}
