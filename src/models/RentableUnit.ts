import type { PricingModel, UnitStatus, UnitType } from './Enums.js';

// Money and area columns are numeric; node-postgres returns numeric as string.
export type RentableUnit = {
  unitId: string;
  propertyId: string;
  name: string;
  unitType: UnitType;
  pricingModel: PricingModel;
  priceAmount: string;
  capacity: number;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqm: string | null;
  status: UnitStatus;
  // Set when the owner removes the unit; see Property.archivedAt.
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
