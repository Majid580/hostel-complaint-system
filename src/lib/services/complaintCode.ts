import { Counter } from "@/models";

/**
 * Human-readable ticket ids: HCMS-2026-000123
 *
 * Students read these out loud to an RT, so they must be short, unambiguous and
 * strictly increasing per year. `findOneAndUpdate` with `$inc` is atomic, so two
 * concurrent submissions can never receive the same number.
 */
export async function nextComplaintCode(now: Date = new Date()): Promise<string> {
  const year = now.getFullYear();
  const counter = await Counter.findOneAndUpdate(
    { _id: `complaint-${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  const seq = counter?.seq ?? 1;
  return `HCMS-${year}-${String(seq).padStart(6, "0")}`;
}

export const COMPLAINT_CODE_REGEX = /^HCMS-\d{4}-\d{6}$/;

export function normalizeComplaintCode(input: string): string | null {
  const cleaned = input.trim().toUpperCase().replace(/\s+/g, "");
  const withPrefix = cleaned.startsWith("HCMS-") ? cleaned : `HCMS-${cleaned}`;
  return COMPLAINT_CODE_REGEX.test(withPrefix) ? withPrefix : null;
}
