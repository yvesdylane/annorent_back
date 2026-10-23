export type Message = {
  messageId: string;
  senderId: string;
  receiverId: string;
  propertyId: string | null;
  bookingId: string | null;
  content: string;
  sentAt: Date;
  createdAt: Date;
  updatedAt: Date;
};
