import { Schema, model, models, type Model, type Types } from "mongoose";
import { HOSTELS, TRADES, type Hostel, type Trade } from "@/lib/domain/constants";

/**
 * The people who actually do the work. Not login accounts (v1) — they are
 * records an RT assigns, and their stats are what make accountability real.
 */
export interface IWorker {
  _id: Types.ObjectId;
  name: string;
  phone?: string;
  trade: Trade;
  /** A worker may serve more than one hostel. */
  hostels: Hostel[];
  isActive: boolean;
  notes?: string;

  createdBy: Types.ObjectId;

  stats: {
    assigned: number;
    completed: number;
    onTime: number;
    reopened: number;
    totalTatHours: number;
  };

  createdAt: Date;
  updatedAt: Date;
}

const WorkerSchema = new Schema<IWorker>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 30 },
    trade: { type: String, enum: TRADES, required: true, index: true },
    hostels: {
      type: [{ type: String, enum: HOSTELS }],
      required: true,
      validate: {
        validator: (v: string[]) => Array.isArray(v) && v.length > 0,
        message: "A worker must serve at least one hostel.",
      },
    },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, maxlength: 500 },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

    stats: {
      assigned: { type: Number, default: 0 },
      completed: { type: Number, default: 0 },
      onTime: { type: Number, default: 0 },
      reopened: { type: Number, default: 0 },
      totalTatHours: { type: Number, default: 0 },
    },
  },
  { timestamps: true, collection: "workers" },
);

WorkerSchema.index({ hostels: 1, trade: 1, isActive: 1 });
WorkerSchema.index({ name: "text", phone: "text" });

export const Worker: Model<IWorker> =
  (models.Worker as Model<IWorker>) ?? model<IWorker>("Worker", WorkerSchema);
