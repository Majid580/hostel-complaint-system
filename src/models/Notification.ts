import { Schema, model, models, type Model, type Types } from "mongoose";

export interface INotification {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: string;
  title: string;
  body: string;
  link?: string;
  isRead: boolean;
  /** danger/warning entries are highlighted in the bell menu. */
  tone: "info" | "success" | "warning" | "danger";
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 1000 },
    link: { type: String },
    isRead: { type: Boolean, default: false, index: true },
    tone: { type: String, enum: ["info", "success", "warning", "danger"], default: "info" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "notifications" },
);

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
// Keep the collection small on a 512 MB free cluster: drop after 90 days.
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const Notification: Model<INotification> =
  (models.Notification as Model<INotification>) ??
  model<INotification>("Notification", NotificationSchema);
