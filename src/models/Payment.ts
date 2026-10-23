import type { PaymentMethod, PaymentStatus } from './Enums.js';

// Money columns are numeric; node-postgres returns numeric as string.
// Refund invariants: status `refunded` means a full refund (refundAmount =
// amount); a partial refund keeps the status and sets refundAmount below
// amount. refundedAt/refundReason are set whenever refundAmount is set.
export type Payment = {
  paymentId: string;
  invoiceId: string;
  amount: string;
  platformCommission: string;
  ownerPayout: string;
  paymentMethod: PaymentMethod;
  providerReference: string;
  status: PaymentStatus;
  refundAmount: string | null;
  refundedAt: Date | null;
  refundReason: string | null;
  // When the owner's share was actually sent. Null until then, and always null
  // for subscription payments (ownerPayout is 0).
  paidOutAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
