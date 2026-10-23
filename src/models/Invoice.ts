import type { InvoiceStatus } from './Enums.js';
import type { DateOnly } from './DateOnly.js';

// Money columns are numeric; node-postgres returns numeric as string.
type InvoiceFields = {
  invoiceId: string;
  amount: string;
  status: InvoiceStatus;
  issuedAt: Date;
  // When payment is expected. "Overdue" is computed (pending and dueAt in the
  // past), never stored. Booking invoices use the booking's expiry, agreement
  // invoices use the period start.
  dueAt: Date;
  // Set when status becomes `paid` or `paid_offline`.
  paidAt: Date | null;
  // Billing period covered. Only agreement invoices have it; unique together
  // with agreementId so the generator job can never bill a period twice.
  periodStart: DateOnly | null;
  periodEnd: DateOnly | null;
  createdAt: Date;
  updatedAt: Date;
};

// Exactly one parent per invoice:
// CHECK (num_nonnulls(booking_id, subscription_id, agreement_id) = 1).
export type Invoice = InvoiceFields &
  (
    | { bookingId: string; subscriptionId: null; agreementId: null }
    | { bookingId: null; subscriptionId: string; agreementId: null }
    | { bookingId: null; subscriptionId: null; agreementId: string }
  );
