import { Schema, model, models, type Model, type Types } from "mongoose";
import { HOSTELS, ROLES, type Hostel, type Role } from "@/lib/domain/constants";

export interface IUser {
  _id: Types.ObjectId;
  role: Role;
  name: string;
  email: string;
  passwordHash: string;
  phone?: string;

  /** Students only — canonical form, e.g. 2023-CS-580 */
  regNo?: string;
  department?: string;
  session?: number;
  roomNo?: string;

  /** Required for STUDENT and RT; null for WARDEN / COORDINATOR (global scope). */
  hostel?: Hostel;

  isActive: boolean;
  emailVerified: boolean;
  mustChangePassword: boolean;
  /** Bump to invalidate every issued session token for this user. */
  tokenVersion: number;

  notificationPrefs: {
    email: boolean;
    digest: "none" | "daily";
  };

  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    role: { type: String, enum: ROLES, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 200,
    },
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, trim: true, maxlength: 30 },

    regNo: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
      maxlength: 20,
    },
    department: { type: String, trim: true, uppercase: true, maxlength: 10 },
    session: { type: Number, min: 1900, max: 2099 },
    roomNo: { type: String, trim: true, maxlength: 20 },

    hostel: { type: String, enum: HOSTELS },

    isActive: { type: Boolean, default: true, index: true },
    emailVerified: { type: Boolean, default: false },
    mustChangePassword: { type: Boolean, default: false },
    tokenVersion: { type: Number, default: 0 },

    notificationPrefs: {
      email: { type: Boolean, default: true },
      digest: { type: String, enum: ["none", "daily"], default: "daily" },
    },

    lastLoginAt: { type: Date },
  },
  { timestamps: true, collection: "users" },
);

// Fast lookup of "the RT of hostel X" and "all wardens".
UserSchema.index({ role: 1, hostel: 1, isActive: 1 });
UserSchema.index({ name: "text", email: "text", regNo: "text" });

export const User: Model<IUser> =
  (models.User as Model<IUser>) ?? model<IUser>("User", UserSchema);
