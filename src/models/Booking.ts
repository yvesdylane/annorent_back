import type { BookingStatus, BookingType } from './Enums.js';

export type Booking = {
  bookingId: string;
  userId: string;
  unitId: string;
  bookingType: BookingType;
  startTime: Date;
  endTime: Date;
  status: BookingStatus;
  // Only for a `pending` booking made through the app: when the hold lapses if
  // the invoice is still unpaid. A job cancels expired bookings and their
  // invoices in one transaction. Null once active, and for agreement bookings.
  expiresAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
