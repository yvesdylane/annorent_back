import type { MediaType, MediaStatus } from './Enums.js';

type MediaFields = {
  mediaId: string;
  type: MediaType;
  storageKey: string;
  status: MediaStatus;
  position: number;
  createdAt: Date;
  updatedAt: Date;
};

// Exactly one parent per media row: CHECK (num_nonnulls(property_id, unit_id) = 1).
export type Media = MediaFields &
  ({ propertyId: string; unitId: null } | { propertyId: null; unitId: string });
