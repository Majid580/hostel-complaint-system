/**
 * Registration number contract: SESSION-DEPT-ROLL  e.g. 2023-CS-580
 *
 *   SESSION  4-digit admission year (1900-2099)
 *   DEPT     2-5 uppercase letters, and — at sign-up — one the institute
 *            actually issues. The shape is checked here; the list of real codes
 *            lives in editable settings, so a new programme needs no code change.
 *   ROLL     1-4 digits, stored without leading zeros
 *
 * Normalisation runs before storage AND before lookup so that
 * "2023-cs-0580", " 2023 - CS - 580 " and "2023-CS-580" are the same student.
 */

export const REG_NO_REGEX = /^(19|20)\d{2}-[A-Z]{2,5}-\d{1,4}$/;
export const REG_NO_EXAMPLE = "2023-CS-580";
export const REG_NO_HINT = "Format: session-department-roll, e.g. 2023-CS-580";

export type ParsedRegNo = {
  regNo: string;
  session: number;
  department: string;
  roll: number;
};

/**
 * Normalise raw user input into the canonical form.
 * Returns null when the input cannot be coerced into a valid registration number.
 */
export function normalizeRegNo(input: string): string | null {
  if (typeof input !== "string") return null;

  const cleaned = input
    .trim()
    .toUpperCase()
    // accept en-dash / em-dash / underscore / slash / spaces as separators
    .replace(/[‐-―_/\\]/g, "-")
    .replace(/\s+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const parts = cleaned.split("-");
  if (parts.length !== 3) return null;

  const [sessionRaw, deptRaw, rollRaw] = parts;

  if (!/^(19|20)\d{2}$/.test(sessionRaw)) return null;
  if (!/^[A-Z]{2,5}$/.test(deptRaw)) return null;
  if (!/^\d{1,6}$/.test(rollRaw)) return null;

  // strip leading zeros but keep at least one digit
  const roll = String(Number(rollRaw));
  if (roll.length > 4) return null;

  const candidate = `${sessionRaw}-${deptRaw}-${roll}`;
  return REG_NO_REGEX.test(candidate) ? candidate : null;
}

export function isValidRegNo(input: string): boolean {
  return normalizeRegNo(input) !== null;
}

export function parseRegNo(input: string): ParsedRegNo | null {
  const regNo = normalizeRegNo(input);
  if (!regNo) return null;

  const [session, department, roll] = regNo.split("-");
  return {
    regNo,
    session: Number(session),
    department,
    roll: Number(roll),
  };
}

/**
 * Human-friendly explanation of *why* a registration number was rejected.
 * Used by the registration form so students can fix their own mistakes.
 */
export function explainRegNoError(input: string): string {
  const raw = (input ?? "").trim();
  if (!raw) return "Registration number is required.";

  const cleaned = raw.toUpperCase().replace(/\s+/g, "").replace(/[‐-―_/\\]/g, "-");
  const parts = cleaned.split("-").filter(Boolean);

  if (parts.length !== 3) {
    return `Use three parts separated by hyphens — session, department and roll number. Example: ${REG_NO_EXAMPLE}`;
  }
  if (!/^(19|20)\d{2}$/.test(parts[0])) {
    return `"${parts[0]}" is not a valid session year. Use a four-digit year, e.g. 2023.`;
  }
  if (!/^[A-Z]{2,5}$/.test(parts[1])) {
    return `"${parts[1]}" is not a valid department code. Use 2-5 letters, e.g. CS, SE, EE, BBA.`;
  }
  if (!/^\d{1,6}$/.test(parts[2])) {
    return `"${parts[2]}" is not a valid roll number. Use digits only, e.g. 580.`;
  }
  if (Number(parts[2]) === 0 || String(Number(parts[2])).length > 4) {
    return "Roll number must be between 1 and 4 digits.";
  }
  return `Registration number is not valid. Example: ${REG_NO_EXAMPLE}`;
}

/**
 * Is this registration number's department one the institute actually issues?
 *
 * The regex only checks shape, so without this `2023-XYZ-001` is a perfectly
 * well-formed number for a department that does not exist. Callers pass the
 * list from settings rather than importing a constant, so the Coordinator can
 * add a programme without a deployment.
 */
export function isAllowedDepartment(department: string, allowed: readonly string[]): boolean {
  if (allowed.length === 0) return true; // no list configured: accept any valid shape
  return allowed.some((code) => code.toUpperCase() === department.toUpperCase());
}

/** Names the departments a student may register under, for a form error. */
export function explainDepartmentError(
  department: string,
  allowed: readonly string[],
): string {
  const list = allowed.join(", ");
  return `"${department}" is not a department at this institute. Use one of: ${list}.`;
}

/** Masked form for public/anonymous display: 2023-CS-580 -> 2023-CS-5** */
export function maskRegNo(regNo: string): string {
  const parsed = parseRegNo(regNo);
  if (!parsed) return "****";
  const roll = String(parsed.roll);
  const visible = roll.slice(0, Math.max(1, roll.length - 2));
  return `${parsed.session}-${parsed.department}-${visible}${"*".repeat(roll.length - visible.length)}`;
}
