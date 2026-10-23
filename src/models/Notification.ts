export type Notification = {
  notificationId: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
};
