import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  EVENT_ACTIONS,
  ROLES,
  STATUSES,
  type ComplaintStatus,
  type EventAction,
  type Role,
} from "@/lib/domain/constants";

/**
 * Append-only audit trail. This collection is what makes the system auditable:
 * nothing here is ever updated or deleted, and the student can read every
 * PUBLIC entry on their own complaint.
 */
export interface IComplaintEvent {
  _id: Types.ObjectId;
  complaintId: Types.ObjectId;
  complaintCode: string;

  /** null when the actor is the scheduled sweep. */
  actorId?: Types.ObjectId | null;
  actorName: string;
  actorRole: Role | "SYSTEM";

  action: EventAction;
  fromStatus?: ComplaintStatus | null;
  toStatus?: ComplaintStatus | null;

  /** Comment body, reason, note — whatever the action carries. */
  message?: string;

  /** INTERNAL entries are hidden from students. */
  visibility: "PUBLIC" | "INTERNAL";

  meta?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;

  createdAt: Date;
}

const ComplaintEventSchema = new Schema<IComplaintEvent>(
  {
    complaintId: { type: Schema.Types.ObjectId, ref: "Complaint", required: true, index: true },
    complaintCode: { type: String, required: true },

    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    actorName: { type: String, required: true },
    actorRole: { type: String, enum: [...ROLES, "SYSTEM"], required: true },

    action: { type: String, enum: EVENT_ACTIONS, required: true, index: true },
    fromStatus: { type: String, enum: [...STATUSES, null], default: null },
    toStatus: { type: String, enum: [...STATUSES, null], default: null },

    message: { type: String, maxlength: 3000 },
    visibility: { type: String, enum: ["PUBLIC", "INTERNAL"], default: "PUBLIC", index: true },

    meta: { type: Schema.Types.Mixed },
    ip: String,
    userAgent: String,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "complaint_events",
  },
);

ComplaintEventSchema.index({ complaintId: 1, createdAt: 1 });
ComplaintEventSchema.index({ actorId: 1, createdAt: -1 });
ComplaintEventSchema.index({ createdAt: -1 });

export const ComplaintEvent: Model<IComplaintEvent> =
  (models.ComplaintEvent as Model<IComplaintEvent>) ??
  model<IComplaintEvent>("ComplaintEvent", ComplaintEventSchema);
