import { connectDB } from "@/lib/db/mongoose";
import { Setting } from "@/models";
import { DEFAULT_SETTINGS, type SettingsShape } from "@/lib/domain/constants";

/**
 * Settings are read on nearly every request, so they are cached in the warm
 * container for 60 seconds. A coordinator edit calls `invalidateSettings()`,
 * and the worst case anywhere else is a one-minute delay.
 */

type CacheEntry = { value: SettingsShape; fetchedAt: number };

const globalForSettings = globalThis as unknown as { __hcmsSettings?: CacheEntry };
const TTL_MS = 60_000;

function withDefaults(doc: Partial<SettingsShape> | null): SettingsShape {
  return {
    sla: { ...DEFAULT_SETTINGS.sla, ...(doc?.sla ?? {}) },
    escalation: { ...DEFAULT_SETTINGS.escalation, ...(doc?.escalation ?? {}) },
    priorityWeights: { ...DEFAULT_SETTINGS.priorityWeights, ...(doc?.priorityWeights ?? {}) },
    attachments: { ...DEFAULT_SETTINGS.attachments, ...(doc?.attachments ?? {}) },
    policy: { ...DEFAULT_SETTINGS.policy, ...(doc?.policy ?? {}) },
    departments: doc?.departments?.length ? doc.departments : [...DEFAULT_SETTINGS.departments],
  };
}

export async function getSettings(): Promise<SettingsShape> {
  const cached = globalForSettings.__hcmsSettings;
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.value;

  try {
    await connectDB();
    const doc = await Setting.findOne({ key: "global" }).lean();
    const value = withDefaults(doc as Partial<SettingsShape> | null);
    globalForSettings.__hcmsSettings = { value, fetchedAt: Date.now() };
    return value;
  } catch {
    // Never let a settings read take down a request — fall back to defaults.
    return withDefaults(null);
  }
}

export function invalidateSettings(): void {
  globalForSettings.__hcmsSettings = undefined;
}

export async function updateSettings(
  patch: Partial<SettingsShape>,
  updatedBy: string,
): Promise<SettingsShape> {
  await connectDB();
  const current = await getSettings();
  const merged = withDefaults({ ...current, ...patch });

  await Setting.findOneAndUpdate(
    { key: "global" },
    { $set: { ...merged, updatedBy } },
    { upsert: true, new: true },
  );

  invalidateSettings();
  return merged;
}

/** Ensures the singleton document exists (called by the seed script). */
export async function ensureSettings(): Promise<void> {
  await connectDB();
  const exists = await Setting.exists({ key: "global" });
  if (!exists) {
    await Setting.create({ key: "global", ...withDefaults(null) });
  }
}
