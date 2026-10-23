// One family per login; reuse of a rotated token revokes the whole family.
export type RefreshToken = {
  tokenId: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
