import { Schema, model, models, type Model } from "mongoose";
import { DEFAULT_SETTINGS, type SettingsShape } from "@/lib/domain/constants";

/**
 * Single-document collection holding every tunable rule (SLA hours, escalation
 * windows, priority weights, policy toggles). The Campus Coordinator edits
 * these in the admin panel, so changing "escalate after 24 h" to 12 h never
 * requires a redeploy.
 */
export interface ISetting extends SettingsShape {
  key: "global";
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SettingSchema = new Schema<ISetting>(
  {
    key: { type: String, default: "global", unique: true },
    sla: { type: Schema.Types.Mixed, default: () => DEFAULT_SETTINGS.sla },
    escalation: { type: Schema.Types.Mixed, default: () => DEFAULT_SETTINGS.escalation },
    priorityWeights: { type: Schema.Types.Mixed, default: () => DEFAULT_SETTINGS.priorityWeights },
    attachments: { type: Schema.Types.Mixed, default: () => DEFAULT_SETTINGS.attachments },
    policy: { type: Schema.Types.Mixed, default: () => DEFAULT_SETTINGS.policy },
    departments: { type: [String], default: () => [...DEFAULT_SETTINGS.departments] },
    updatedBy: { type: String },
  },
  { timestamps: true, collection: "settings", minimize: false },
);

export const Setting: Model<ISetting> =
  (models.Setting as Model<ISetting>) ?? model<ISetting>("Setting", SettingSchema);
