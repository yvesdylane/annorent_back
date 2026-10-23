// Insert-only: never updated or deleted (database-model.md §6.8). That is why
// there is no updatedAt.
export type PaymentReceipt = {
  receiptId: string;
  paymentId: string;
  invoiceId: string;
  transactionDetails: Record<string, unknown>;
  signatureHash: string;
  issuedAt: Date;
  createdAt: Date;
};
