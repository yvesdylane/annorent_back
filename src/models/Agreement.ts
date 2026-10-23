import type { AgreementStatus, BillingInterval } from './Enums.js';
import type { DateOnly } from './DateOnly.js';

// A price negotiated between an owner and ONE tenant for a unit. It is not the
// unit's list price, and it does not affect anyone else.
//
// Billing: each period is billed in advance. The first invoice is due on
// `startDate`; with a `billingInterval` a new invoice is generated for each
// following period until `endDate` (or forever if null). A null interval is a
// single charge. Invoices copy `agreedAmount` when generated, so changing the
// price later never rewrites old invoices.
//
// Lifecycle: the owner creates it as `proposed`. When the tenant accepts it
// becomes `active` and `bookingId` is filled with the occupancy booking
// (the no-overlap constraint may reject it if the unit was taken meanwhile).
export type Agreement = {
  agreementId: string;
  unitId: string;
  tenantId: string;
  bookingId: string | null;
  // numeric: node-postgres returns it as string.
  agreedAmount: string;
  billingInterval: BillingInterval | null;
  startDate: DateOnly;
  endDate: DateOnly | null;
  status: AgreementStatus;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
