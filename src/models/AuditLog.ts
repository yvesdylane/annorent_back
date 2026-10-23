// Insert-only: never updated or deleted (database-model.md §6.8).
export type AuditLog = {
  logId: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  requestId: string;
  createdAt: Date;
};
