/**
 * Small infrastructure collections that keep the app running on free tiers:
 * OTP tokens, serverless-safe rate limiting, the outbound mail queue, the
 * ticket-number counter and a light system log.
 */
import { Schema, model, models, type Model, type Types } from "mongoose";

/* ---------------------------------------------------------------------------
 * OTP tokens — e-mail verification and password reset
 * ------------------------------------------------------------------------ */

export interface IOtpToken {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  purpose: "VERIFY_EMAIL" | "RESET_PASSWORD";
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt?: Date | null;
  createdAt: Date;
}

const OtpTokenSchema = new Schema<IOtpToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    purpose: { type: String, enum: ["VERIFY_EMAIL", "RESET_PASSWORD"], required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "otp_tokens" },
);
// Mongo removes the document itself once it expires.
OtpTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpToken: Model<IOtpToken> =
  (models.OtpToken as Model<IOtpToken>) ?? model<IOtpToken>("OtpToken", OtpTokenSchema);

/* ---------------------------------------------------------------------------
 * Rate limiting — Mongo-backed because serverless has no shared memory
 * ------------------------------------------------------------------------ */

export interface IRateLimit {
  _id: Types.ObjectId;
  key: string;
  count: number;
  windowStart: Date;
  expiresAt: Date;
}

const RateLimitSchema = new Schema<IRateLimit>(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 },
    windowStart: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { collection: "rate_limits", versionKey: false },
);
RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimit: Model<IRateLimit> =
  (models.RateLimit as Model<IRateLimit>) ?? model<IRateLimit>("RateLimit", RateLimitSchema);

/* ---------------------------------------------------------------------------
 * Mail queue — a failed SMTP call must never fail the user's request
 * ------------------------------------------------------------------------ */

export interface IMailQueue {
  _id: Types.ObjectId;
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  text: string;
  status: "PENDING" | "SENT" | "FAILED";
  attempts: number;
  lastError?: string;
  sendAfter: Date;
  sentAt?: Date | null;
  relatedComplaint?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const MailQueueSchema = new Schema<IMailQueue>(
  {
    to: { type: [String], required: true },
    cc: { type: [String], default: [] },
    subject: { type: String, required: true },
    html: { type: String, required: true },
    text: { type: String, required: true },
    status: { type: String, enum: ["PENDING", "SENT", "FAILED"], default: "PENDING", index: true },
    attempts: { type: Number, default: 0 },
    lastError: { type: String },
    sendAfter: { type: Date, default: Date.now, index: true },
    sentAt: { type: Date, default: null },
    relatedComplaint: { type: Schema.Types.ObjectId, ref: "Complaint", default: null },
  },
  { timestamps: true, collection: "mail_queue" },
);
MailQueueSchema.index({ status: 1, sendAfter: 1 });
// Sent mail bodies are pruned after 30 days to protect the 512 MB budget.
MailQueueSchema.index({ sentAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export const MailQueue: Model<IMailQueue> =
  (models.MailQueue as Model<IMailQueue>) ?? model<IMailQueue>("MailQueue", MailQueueSchema);

/* ---------------------------------------------------------------------------
 * Counter — atomic sequence for human-readable ticket codes
 * ------------------------------------------------------------------------ */

export interface ICounter {
  _id: string; // e.g. "complaint-2026"
  seq: number;
}

const CounterSchema = new Schema<ICounter>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { collection: "counters", versionKey: false },
);

export const Counter: Model<ICounter> =
  (models.Counter as Model<ICounter>) ?? model<ICounter>("Counter", CounterSchema);

/* ---------------------------------------------------------------------------
 * System log — cron runs, mail failures, unexpected errors
 * ------------------------------------------------------------------------ */

export interface ISystemLog {
  _id: Types.ObjectId;
  level: "INFO" | "WARN" | "ERROR";
  source: string;
  message: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const SystemLogSchema = new Schema<ISystemLog>(
  {
    level: { type: String, enum: ["INFO", "WARN", "ERROR"], default: "INFO", index: true },
    source: { type: String, required: true, index: true },
    message: { type: String, required: true },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "system_logs" },
);
SystemLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 60 });

export const SystemLog: Model<ISystemLog> =
  (models.SystemLog as Model<ISystemLog>) ?? model<ISystemLog>("SystemLog", SystemLogSchema);
