import type { PropertyType } from './Enums.js';

export type GeoPoint = { lat: number; lng: number };

export type Property = {
  propertyId: string;
  accountId: string;
  propertyType: PropertyType;
  name: string;
  description: string | null;
  country: string;
  city: string;
  town: string;
  area: string;
  street: string | null;
  // Column is geography(Point, 4326). The repository selects it as
  // ST_Y(gps::geometry) AS lat, ST_X(gps::geometry) AS lng, and only for the
  // owner, an admin, or a user with an active booking on one of the property's
  // units (database-model.md §6.5). Everyone else gets null.
  location: GeoPoint | null;
  ownershipVerified: boolean;
  // Set when the owner removes the listing. Rows are archived, never deleted,
  // because bookings and invoices keep pointing at them.
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
