import type { VerificationStatus } from './Enums.js';

export type BusinessAccount = {
  accountId: string;
  userId: string;
  businessName: string;
  taxInfo: string | null;
  verificationStatus: VerificationStatus;
  createdAt: Date;
  updatedAt: Date;
};
