import { Schema, model, models, type Model, type Types } from "mongoose";
import { HOSTELS, type Hostel } from "@/lib/domain/constants";

/**
 * Notice board. Lets the Warden/RT get ahead of a wave of duplicate complaints
 * ("water supply is off until 6 pm") instead of answering each one separately.
 */
export interface IAnnouncement {
  _id: Types.ObjectId;
  title: string;
  body: string;
  hostels: Hostel[];
  audience: "ALL" | "STUDENTS" | "STAFF";
  tone: "info" | "warning" | "danger" | "success";
  pinned: boolean;
  startsAt: Date;
  endsAt?: Date | null;
  createdBy: Types.ObjectId;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    hostels: { type: [{ type: String, enum: HOSTELS }], default: [...HOSTELS] },
    audience: { type: String, enum: ["ALL", "STUDENTS", "STAFF"], default: "ALL" },
    tone: { type: String, enum: ["info", "warning", "danger", "success"], default: "info" },
    pinned: { type: Boolean, default: false },
    startsAt: { type: Date, default: Date.now, index: true },
    endsAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true, collection: "announcements" },
);

AnnouncementSchema.index({ hostels: 1, startsAt: -1 });
AnnouncementSchema.index({ pinned: -1, startsAt: -1 });

export const Announcement: Model<IAnnouncement> =
  (models.Announcement as Model<IAnnouncement>) ??
  model<IAnnouncement>("Announcement", AnnouncementSchema);
