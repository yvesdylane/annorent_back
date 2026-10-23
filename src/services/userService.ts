import { Injectable } from '@nestjs/common';
import { UserRole, VerificationStatus } from '../models/Enums.js';
import type { PublicUser, User } from '../models/User.js';

const helloUser: User = {
  userId: '00000000-0000-4000-8000-000000000001',
  name: 'Annorent',
  email: 'hello@annorent.cm',
  phoneNumber: null,
  passwordHash: 'demo-hash',
  role: UserRole.Admin,
  kycStatus: VerificationStatus.Verified,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

@Injectable()
export class UserService {
  getHelloUser(): PublicUser {
    const { passwordHash: _passwordHash, ...publicUser } = helloUser;
    return publicUser;
  }
}
