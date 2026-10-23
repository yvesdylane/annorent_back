// Postgres enum types (database-model.md §4). Keys are PascalCase for use as
// constants, values are the exact lowercase snake_case strings stored in the DB.

// Application-level role. `visitor` is what guards resolve for an
// unauthenticated request; it is never stored.
export const UserRole = {
  Visitor: 'visitor',
  Tenant: 'tenant',
  Owner: 'owner',
  Admin: 'admin',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// The roles a `users` row can actually hold (the `user_role` Postgres enum).
export type StoredUserRole = Exclude<UserRole, typeof UserRole.Visitor>;

export const VerificationStatus = {
  Pending: 'pending',
  Verified: 'verified',
  Rejected: 'rejected',
} as const;
export type VerificationStatus = (typeof VerificationStatus)[keyof typeof VerificationStatus];

export const PropertyType = {
  Building: 'building',
  Hotel: 'hotel',
} as const;
export type PropertyType = (typeof PropertyType)[keyof typeof PropertyType];

export const UnitType = {
  GuestHouse: 'guest_house',
  CoworkSpace: 'cowork_space',
  EventHall: 'event_hall',
  Room: 'room',
  Apartment: 'apartment',
  Studio: 'studio',
  HotelRoom: 'hotel_room',
} as const;
export type UnitType = (typeof UnitType)[keyof typeof UnitType];

export const PricingModel = {
  Hourly: 'hourly',
  HalfDay: 'half_day',
  Daily: 'daily',
  Nightly: 'nightly',
  Monthly: 'monthly',
} as const;
export type PricingModel = (typeof PricingModel)[keyof typeof PricingModel];

// Availability for a date range comes from `bookings`, never from this flag:
// `occupied` was removed so there is a single source of truth.
export const UnitStatus = {
  Available: 'available',
  Maintenance: 'maintenance',
} as const;
export type UnitStatus = (typeof UnitStatus)[keyof typeof UnitStatus];

export const MediaType = {
  Photo: 'photo',
  Video: 'video',
  Tour3d: 'tour_3d',
} as const;
export type MediaType = (typeof MediaType)[keyof typeof MediaType];

export const MediaStatus = {
  Uploading: 'uploading',
  Processing: 'processing',
  Ready: 'ready',
  Failed: 'failed',
} as const;
export type MediaStatus = (typeof MediaStatus)[keyof typeof MediaStatus];

export const BookingType = {
  Reservation: 'reservation',
  RentalBooking: 'rental_booking',
} as const;
export type BookingType = (typeof BookingType)[keyof typeof BookingType];

// `pending` holds the unit until the invoice is paid (or `expires_at` passes);
// `active` means confirmed. Both block the unit in the no-overlap constraint.
export const BookingStatus = {
  Pending: 'pending',
  Active: 'active',
  Cancelled: 'cancelled',
  Completed: 'completed',
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

// `paid_offline`: the owner confirms the tenant paid outside the app. No
// `payments` row exists and the platform takes no commission.
export const InvoiceStatus = {
  Pending: 'pending',
  Paid: 'paid',
  PaidOffline: 'paid_offline',
  Cancelled: 'cancelled',
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const PaymentMethod = {
  MobileMoney: 'mobile_money',
  BankTransfer: 'bank_transfer',
  Card: 'card',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentStatus = {
  Pending: 'pending',
  Successful: 'successful',
  Failed: 'failed',
  Refunded: 'refunded',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const VisitStatus = {
  Requested: 'requested',
  Confirmed: 'confirmed',
  Completed: 'completed',
  Cancelled: 'cancelled',
} as const;
export type VisitStatus = (typeof VisitStatus)[keyof typeof VisitStatus];

export const PlanType = {
  Monthly: 'monthly',
  Yearly: 'yearly',
} as const;
export type PlanType = (typeof PlanType)[keyof typeof PlanType];

export const SubscriptionStatus = {
  Active: 'active',
  Expired: 'expired',
  Cancelled: 'cancelled',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

// How often an agreement bills. A null interval on the agreement is a one-time
// charge, so there is no `once` value.
export const BillingInterval = {
  Daily: 'daily',
  Monthly: 'monthly',
  Yearly: 'yearly',
} as const;
export type BillingInterval = (typeof BillingInterval)[keyof typeof BillingInterval];

// proposed: the owner created it, waiting for the tenant.
// active:   the tenant accepted; the booking exists and invoices are generated.
export const AgreementStatus = {
  Proposed: 'proposed',
  Active: 'active',
  Ended: 'ended',
  Cancelled: 'cancelled',
} as const;
export type AgreementStatus = (typeof AgreementStatus)[keyof typeof AgreementStatus];
