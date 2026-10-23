import type { VisitStatus } from './Enums.js';

export type PropertyVisit = {
  visitId: string;
  userId: string;
  propertyId: string;
  unitId: string | null;
  scheduledTime: Date;
  status: VisitStatus;
  createdAt: Date;
  updatedAt: Date;
};
