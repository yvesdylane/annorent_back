import type { PlanType, SubscriptionStatus } from './Enums.js';
import type { DateOnly } from './DateOnly.js';

// Each row is one subscription instance of a business account. A renewal is a
// new row whose renewedFrom points at the instance it replaces.
export type SubscriptionPlan = {
  subscriptionId: string;
  accountId: string;
  planType: PlanType;
  price: string;
  startDate: DateOnly;
  endDate: DateOnly;
  status: SubscriptionStatus;
  renewedFrom: string | null;
  createdAt: Date;
  updatedAt: Date;
};
