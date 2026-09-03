import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  CATEGORIES,
  HOSTELS,
  SEVERITIES,
  STATUSES,
  TRADES,
  type Category,
  type ComplaintStatus,
  type Hostel,
  type Severity,
  type Trade,
} from "@/lib/domain/constants";

export interface IAttachment {
  url: string;
  publicId: string;
  kind: "image" | "audio";
  bytes: number;
  mimeType: string;
  width?: number;
  height?: number;
  /** seconds, audio only */
  duration?: number;
  uploadedAt?: Date;
}

export interface IComplaint {
  _id: Types.ObjectId;
  /** Human-readable ticket id, e.g. HCMS-2026-000123 */
  code: string;

  /** Snapshot of the reporter so the complaint stays readable if the user is edited. */
  student: {
    userId: Types.ObjectId;
    regNo: string;
    name: string;
    email: string;
    phone?: string;
    roomNo?: string;
  };

  hostel: Hostel;
  category: Category;
  title: string;
  description: string;
  location?: string;

  images: IAttachment[];
  audio?: IAttachment | null;

  severity: Severity;
  severityOverriddenBy?: Types.ObjectId | null;

  status: ComplaintStatus;
  priorityScore: number;
  /** 0 = none, 1 = warden, 2 = campus coordinator */
  escalationLevel: 0 | 1 | 2;
  isDisputed: boolean;

  assignment?: {
    workerId: Types.ObjectId;
    workerName: string;
    workerPhone?: string;
    trade: Trade;
    assignedBy: Types.ObjectId;
    assignedByName: string;
    assignedAt: Date;
    expectedCompletionAt?: Date | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
    remarks?: string;
  } | null;

  resolution?: {
    resolvedBy: Types.ObjectId;
    resolvedByName: string;
    resolvedByRole: string;
    resolvedAt: Date;
    note: string;
    proofImages: IAttachment[];
  } | null;

  verification?: {
    verifiedBy?: Types.ObjectId | null;
    verifiedAt: Date;
    method: "STUDENT" | "AUTO" | "STAFF";
    rating?: number;
    feedback?: string;
  } | null;

  rejection?: {
    rejectedBy: Types.ObjectId;
    rejectedByName: string;
    rejectedAt: Date;
    reason: string;
  } | null;

  onHold?: {
    reason: string;
    until?: Date | null;
    setBy: Types.ObjectId;
    setAt: Date;
  } | null;

  sla: {
    ackDueAt: Date;
    resolveDueAt: Date;
    ackBreached: boolean;
    resolveBreached: boolean;
    firstResponseAt?: Date | null;
  };

  upvotes: Types.ObjectId[];
  upvoteCount: number;

  duplicateOf?: Types.ObjectId | null;
  reopenCount: number;

  lastEscalatedAt?: Date | null;
  /** Any staff action or student interaction; drives the stale-complaint sweep. */
  lastActivityAt: Date;

  isAnonymous: boolean;
  deletedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const AttachmentSchema = new Schema<IAttachment>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    kind: { type: String, enum: ["image", "audio"], required: true },
    bytes: { type: Number, required: true },
    mimeType: { type: String, required: true },
    width: Number,
    height: Number,
    duration: Number,
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const ComplaintSchema = new Schema<IComplaint>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },

    student: {
      userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
      regNo: { type: String, required: true, uppercase: true, trim: true, index: true },
      name: { type: String, required: true },
      email: { type: String, required: true, lowercase: true },
      phone: String,
      roomNo: String,
    },

    hostel: { type: String, enum: HOSTELS, required: true, index: true },
    category: { type: String, enum: CATEGORIES, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 3000 },
    location: { type: String, trim: true, maxlength: 160 },

    images: { type: [AttachmentSchema], default: [] },
    audio: { type: AttachmentSchema, default: null },

    severity: { type: String, enum: SEVERITIES, required: true, index: true },
    severityOverriddenBy: { type: Schema.Types.ObjectId, ref: "User", default: null },

    status: { type: String, enum: STATUSES, default: "SUBMITTED", index: true },
    priorityScore: { type: Number, default: 0, index: true },
    escalationLevel: { type: Number, enum: [0, 1, 2], default: 0, index: true },
    isDisputed: { type: Boolean, default: false, index: true },

    assignment: {
      type: new Schema(
        {
          workerId: { type: Schema.Types.ObjectId, ref: "Worker", required: true },
          workerName: { type: String, required: true },
          workerPhone: String,
          trade: { type: String, enum: TRADES, required: true },
          assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
          assignedByName: { type: String, required: true },
          assignedAt: { type: Date, required: true },
          expectedCompletionAt: { type: Date, default: null },
          startedAt: { type: Date, default: null },
          completedAt: { type: Date, default: null },
          remarks: String,
        },
        { _id: false },
      ),
      default: null,
    },

    resolution: {
      type: new Schema(
        {
          resolvedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
          resolvedByName: { type: String, required: true },
          resolvedByRole: { type: String, required: true },
          resolvedAt: { type: Date, required: true },
          note: { type: String, required: true },
          proofImages: { type: [AttachmentSchema], default: [] },
        },
        { _id: false },
      ),
      default: null,
    },

    verification: {
      type: new Schema(
        {
          verifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
          verifiedAt: { type: Date, required: true },
          method: { type: String, enum: ["STUDENT", "AUTO", "STAFF"], required: true },
          rating: { type: Number, min: 1, max: 5 },
          feedback: { type: String, maxlength: 1000 },
        },
        { _id: false },
      ),
      default: null,
    },

    rejection: {
      type: new Schema(
        {
          rejectedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
          rejectedByName: { type: String, required: true },
          rejectedAt: { type: Date, required: true },
          reason: { type: String, required: true },
        },
        { _id: false },
      ),
      default: null,
    },

    onHold: {
      type: new Schema(
        {
          reason: { type: String, required: true },
          until: { type: Date, default: null },
          setBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
          setAt: { type: Date, required: true },
        },
        { _id: false },
      ),
      default: null,
    },

    sla: {
      ackDueAt: { type: Date, required: true },
      resolveDueAt: { type: Date, required: true },
      ackBreached: { type: Boolean, default: false },
      resolveBreached: { type: Boolean, default: false },
      firstResponseAt: { type: Date, default: null },
    },

    upvotes: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
    upvoteCount: { type: Number, default: 0 },

    duplicateOf: { type: Schema.Types.ObjectId, ref: "Complaint", default: null },
    reopenCount: { type: Number, default: 0 },

    lastEscalatedAt: { type: Date, default: null },
    lastActivityAt: { type: Date, default: Date.now, index: true },

    isAnonymous: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "complaints" },
);

/* --- Indexes that back the actual query patterns -------------------------- */

// Staff queue: filter by hostel + status, sort by priority.
ComplaintSchema.index({ hostel: 1, status: 1, priorityScore: -1, createdAt: 1 });
// Student dashboard.
ComplaintSchema.index({ "student.userId": 1, createdAt: -1 });
// Warden escalation inbox.
ComplaintSchema.index({ escalationLevel: -1, status: 1, priorityScore: -1 });
// SLA sweep.
ComplaintSchema.index({ status: 1, "sla.resolveDueAt": 1 });
// Stale-complaint sweep (E2).
ComplaintSchema.index({ status: 1, lastActivityAt: 1, escalationLevel: 1 });
// Auto-close sweep (E7).
ComplaintSchema.index({ status: 1, "resolution.resolvedAt": 1 });
// Full-text search across the queue.
ComplaintSchema.index({ title: "text", description: "text", code: "text", location: "text" });

export const Complaint: Model<IComplaint> =
  (models.Complaint as Model<IComplaint>) ?? model<IComplaint>("Complaint", ComplaintSchema);
