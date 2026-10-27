import type { StoredUserRole, VerificationStatus } from './Enums.js';

// `role` is a stored role: a visitor has no account, so it never has a row
// (database-model.md §4.1).
export type User = {
  userId: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  passwordHash: string | null;
  role: StoredUserRole;
  kycStatus: VerificationStatus;
  createdAt: Date;
  updatedAt: Date;
};

// What may leave the API. Never return `User` itself.
export type PublicUser = Omit<User, 'passwordHash'>;
