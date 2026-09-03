/**
 * Domain constants — the single source of truth for hostels, roles, statuses,
 * severities, categories and trades.
 *
 * Everything else (models, Zod schemas, UI badges, analytics) derives from this
 * file, so adding a category or a hostel is a one-line change.
 */

/* ---------------------------------------------------------------------------
 * Hostels
 * ------------------------------------------------------------------------ */

export const HOSTELS = ["GIRLS", "QASIM", "FATIMA"] as const;
export type Hostel = (typeof HOSTELS)[number];

export const HOSTEL_META: Record<Hostel, { label: string; short: string; gender: "F" | "M" }> = {
  GIRLS: { label: "Girls Hostel", short: "Girls", gender: "F" },
  QASIM: { label: "Qasim Hostel", short: "Qasim", gender: "M" },
  FATIMA: { label: "Fatima Hostel", short: "Fatima", gender: "F" },
};

export const HOSTEL_OPTIONS = HOSTELS.map((h) => ({ value: h, label: HOSTEL_META[h].label }));

/* ---------------------------------------------------------------------------
 * Roles
 * ------------------------------------------------------------------------ */

export const ROLES = ["STUDENT", "RT", "WARDEN", "COORDINATOR"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_META: Record<Role, { label: string; short: string; scope: "own" | "hostel" | "all" }> = {
  STUDENT: { label: "Student", short: "Student", scope: "own" },
  RT: { label: "Resident Tutor", short: "RT", scope: "hostel" },
  WARDEN: { label: "Hostel Warden", short: "Warden", scope: "all" },
  COORDINATOR: { label: "Campus Coordinator", short: "Coordinator", scope: "all" },
};

/** Roles that can act on complaints (acknowledge, assign, change status). */
export const STAFF_ROLES = ["RT", "WARDEN", "COORDINATOR"] as const satisfies readonly Role[];
/** Roles that see every hostel. */
export const GLOBAL_ROLES = ["WARDEN", "COORDINATOR"] as const satisfies readonly Role[];

export function isStaff(role: Role): boolean {
  return (STAFF_ROLES as readonly Role[]).includes(role);
}
export function isGlobalRole(role: Role): boolean {
  return (GLOBAL_ROLES as readonly Role[]).includes(role);
}

/* ---------------------------------------------------------------------------
 * Complaint status
 * ------------------------------------------------------------------------ */

export const STATUSES = [
  "SUBMITTED",
  "ACKNOWLEDGED",
  "ASSIGNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "RESOLVED",
  "VERIFIED_CLOSED",
  "REOPENED",
  "REJECTED",
] as const;
export type ComplaintStatus = (typeof STATUSES)[number];

/**
 * `tone` maps to the badge palette. `stage` drives the progress stepper.
 * `isOpen` decides whether SLA clocks and escalation sweeps apply.
 */
export const STATUS_META: Record<
  ComplaintStatus,
  {
    label: string;
    description: string;
    tone: "neutral" | "info" | "primary" | "warning" | "success" | "danger" | "accent";
    stage: number; // 0..4 for the stepper; -1 = terminal off-track
    isOpen: boolean;
    isTerminal: boolean;
  }
> = {
  SUBMITTED: {
    label: "Submitted",
    description: "Received and waiting for the Resident Tutor to acknowledge it.",
    tone: "info",
    stage: 0,
    isOpen: true,
    isTerminal: false,
  },
  ACKNOWLEDGED: {
    label: "Acknowledged",
    description: "Seen by the Resident Tutor; a worker has not been assigned yet.",
    tone: "primary",
    stage: 1,
    isOpen: true,
    isTerminal: false,
  },
  ASSIGNED: {
    label: "Assigned",
    description: "A worker has been assigned and is scheduled to attend.",
    tone: "accent",
    stage: 2,
    isOpen: true,
    isTerminal: false,
  },
  IN_PROGRESS: {
    label: "In progress",
    description: "Work is actively under way.",
    tone: "warning",
    stage: 3,
    isOpen: true,
    isTerminal: false,
  },
  ON_HOLD: {
    label: "On hold",
    description: "Temporarily paused — a reason and an expected resume date are recorded.",
    tone: "neutral",
    stage: 3,
    isOpen: true,
    isTerminal: false,
  },
  RESOLVED: {
    label: "Resolved — awaiting your confirmation",
    description: "Staff marked the work complete. Confirm it, or report that it is still pending.",
    tone: "success",
    stage: 4,
    isOpen: true,
    isTerminal: false,
  },
  VERIFIED_CLOSED: {
    label: "Closed",
    description: "Confirmed as fixed and closed.",
    tone: "success",
    stage: 5,
    isOpen: false,
    isTerminal: true,
  },
  REOPENED: {
    label: "Reopened",
    description: "The student reported that the problem is not actually fixed.",
    tone: "danger",
    stage: 1,
    isOpen: true,
    isTerminal: false,
  },
  REJECTED: {
    label: "Rejected",
    description: "Not actionable — a written reason is recorded.",
    tone: "danger",
    stage: -1,
    isOpen: false,
    isTerminal: true,
  },
};

export const OPEN_STATUSES = STATUSES.filter((s) => STATUS_META[s].isOpen);
export const CLOSED_STATUSES = STATUSES.filter((s) => !STATUS_META[s].isOpen);
/** Statuses that still need staff action (excludes RESOLVED, which waits on the student). */
export const ACTIONABLE_STATUSES = [
  "SUBMITTED",
  "ACKNOWLEDGED",
  "ASSIGNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "REOPENED",
] as const satisfies readonly ComplaintStatus[];

/* ---------------------------------------------------------------------------
 * Severity
 * ------------------------------------------------------------------------ */

export const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_META: Record<
  Severity,
  {
    label: string;
    hint: string;
    weight: number;
    tone: "neutral" | "info" | "warning" | "danger";
    /** Hours allowed to acknowledge / to resolve. Overridable in system settings. */
    ackHours: number;
    resolveHours: number;
  }
> = {
  LOW: {
    label: "Low",
    hint: "Minor inconvenience — can wait a few days.",
    weight: 10,
    tone: "neutral",
    ackHours: 24,
    resolveHours: 168,
  },
  MEDIUM: {
    label: "Medium",
    hint: "Affects daily routine but is manageable.",
    weight: 30,
    tone: "info",
    ackHours: 12,
    resolveHours: 72,
  },
  HIGH: {
    label: "High",
    hint: "Room or facility is largely unusable.",
    weight: 60,
    tone: "warning",
    ackHours: 4,
    resolveHours: 24,
  },
  CRITICAL: {
    label: "Critical",
    hint: "Safety, health or security risk — needs attention now.",
    weight: 100,
    tone: "danger",
    ackHours: 2,
    resolveHours: 8,
  },
};

export const SEVERITY_ORDER: Record<Severity, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

/* ---------------------------------------------------------------------------
 * Trades (who fixes what)
 * ------------------------------------------------------------------------ */

export const TRADES = [
  "ELECTRICIAN",
  "PLUMBER",
  "CARPENTER",
  "MASON",
  "CLEANER",
  "IT_NETWORK",
  "AC_TECHNICIAN",
  "PEST_CONTROL",
  "SECURITY",
  "GENERAL",
] as const;
export type Trade = (typeof TRADES)[number];

export const TRADE_LABEL: Record<Trade, string> = {
  ELECTRICIAN: "Electrician",
  PLUMBER: "Plumber",
  CARPENTER: "Carpenter",
  MASON: "Mason",
  CLEANER: "Cleaning staff",
  IT_NETWORK: "IT / Network",
  AC_TECHNICIAN: "AC / HVAC technician",
  PEST_CONTROL: "Pest control",
  SECURITY: "Security",
  GENERAL: "General maintenance",
};

/* ---------------------------------------------------------------------------
 * Categories
 * ------------------------------------------------------------------------ */

export const CATEGORIES = [
  "ELECTRICITY",
  "PLUMBING_WATER",
  "INTERNET_WIFI",
  "FURNITURE",
  "CLEANLINESS_SANITATION",
  "MESS_FOOD",
  "SECURITY_SAFETY",
  "LAUNDRY",
  "AC_HEATING_FAN",
  "PEST_CONTROL",
  "CIVIL_STRUCTURAL",
  "GAS",
  "LIFT_ELEVATOR",
  "NOISE_DISCIPLINE",
  "OTHER",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_META: Record<
  Category,
  {
    label: string;
    /** lucide-react icon name, resolved in the UI layer */
    icon: string;
    defaultSeverity: Severity;
    defaultTrade: Trade;
    /** Safety-critical categories get a permanent priority boost. */
    isSafety: boolean;
    examples: string;
  }
> = {
  ELECTRICITY: {
    label: "Electricity",
    icon: "Zap",
    defaultSeverity: "HIGH",
    defaultTrade: "ELECTRICIAN",
    isSafety: true,
    examples: "No power, exposed wiring, broken switch or socket, tripping breaker",
  },
  PLUMBING_WATER: {
    label: "Plumbing & water",
    icon: "Droplets",
    defaultSeverity: "HIGH",
    defaultTrade: "PLUMBER",
    isSafety: false,
    examples: "No water, leaking tap, blocked drain, broken flush, geyser fault",
  },
  INTERNET_WIFI: {
    label: "Internet / Wi-Fi",
    icon: "Wifi",
    defaultSeverity: "MEDIUM",
    defaultTrade: "IT_NETWORK",
    isSafety: false,
    examples: "No signal in the room, very slow speed, cannot connect",
  },
  FURNITURE: {
    label: "Furniture",
    icon: "Armchair",
    defaultSeverity: "LOW",
    defaultTrade: "CARPENTER",
    isSafety: false,
    examples: "Broken bed, wobbly table, damaged cupboard, missing chair",
  },
  CLEANLINESS_SANITATION: {
    label: "Cleanliness & sanitation",
    icon: "Trash2",
    defaultSeverity: "MEDIUM",
    defaultTrade: "CLEANER",
    isSafety: false,
    examples: "Washroom not cleaned, garbage not collected, dirty corridor",
  },
  MESS_FOOD: {
    label: "Mess & food",
    icon: "UtensilsCrossed",
    defaultSeverity: "MEDIUM",
    defaultTrade: "GENERAL",
    isSafety: false,
    examples: "Food quality, hygiene in the mess, timings, portion size",
  },
  SECURITY_SAFETY: {
    label: "Security & safety",
    icon: "ShieldAlert",
    defaultSeverity: "CRITICAL",
    defaultTrade: "SECURITY",
    isSafety: true,
    examples: "Broken lock, unauthorised entry, missing fire extinguisher, theft",
  },
  LAUNDRY: {
    label: "Laundry",
    icon: "Shirt",
    defaultSeverity: "LOW",
    defaultTrade: "GENERAL",
    isSafety: false,
    examples: "Washing machine out of order, laundry not returned",
  },
  AC_HEATING_FAN: {
    label: "AC, heater & fan",
    icon: "Fan",
    defaultSeverity: "MEDIUM",
    defaultTrade: "AC_TECHNICIAN",
    isSafety: false,
    examples: "Fan not working, AC not cooling, heater fault",
  },
  PEST_CONTROL: {
    label: "Pest control",
    icon: "Bug",
    defaultSeverity: "MEDIUM",
    defaultTrade: "PEST_CONTROL",
    isSafety: false,
    examples: "Cockroaches, rats, mosquitoes, termites",
  },
  CIVIL_STRUCTURAL: {
    label: "Civil & structural",
    icon: "Hammer",
    defaultSeverity: "MEDIUM",
    defaultTrade: "MASON",
    isSafety: false,
    examples: "Cracked wall, seepage, broken window or door, damaged floor",
  },
  GAS: {
    label: "Gas supply",
    icon: "Flame",
    defaultSeverity: "CRITICAL",
    defaultTrade: "GENERAL",
    isSafety: true,
    examples: "Gas leak, no gas supply, faulty stove",
  },
  LIFT_ELEVATOR: {
    label: "Lift / elevator",
    icon: "ArrowUpDown",
    defaultSeverity: "HIGH",
    defaultTrade: "GENERAL",
    isSafety: true,
    examples: "Lift stuck, out of order, doors not closing",
  },
  NOISE_DISCIPLINE: {
    label: "Noise & discipline",
    icon: "VolumeX",
    defaultSeverity: "LOW",
    defaultTrade: "GENERAL",
    isSafety: false,
    examples: "Loud noise at night, disturbance, rule violations",
  },
  OTHER: {
    label: "Other",
    icon: "CircleHelp",
    defaultSeverity: "MEDIUM",
    defaultTrade: "GENERAL",
    isSafety: false,
    examples: "Anything that does not fit the categories above",
  },
};

export const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({
  value: c,
  label: CATEGORY_META[c].label,
}));

/* ---------------------------------------------------------------------------
 * Timeline actions (append-only audit vocabulary)
 * ------------------------------------------------------------------------ */

export const EVENT_ACTIONS = [
  "CREATED",
  "STATUS_CHANGED",
  "SEVERITY_CHANGED",
  "CATEGORY_CHANGED",
  "WORKER_ASSIGNED",
  "WORKER_UNASSIGNED",
  "COMMENT_ADDED",
  "INTERNAL_NOTE_ADDED",
  "ESCALATED",
  "FALSE_RESOLUTION_FLAGGED",
  "VERIFIED",
  "REOPENED",
  "REJECTED",
  "UPVOTED",
  "AUTO_CLOSED",
  "SLA_BREACHED",
  "ATTACHMENT_ADDED",
  "DUPLICATE_LINKED",
  "PRIORITY_RECOMPUTED",
] as const;
export type EventAction = (typeof EVENT_ACTIONS)[number];

/* ---------------------------------------------------------------------------
 * Defaults that live in the editable `settings` document
 * ------------------------------------------------------------------------ */

export const DEFAULT_SETTINGS = {
  sla: {
    LOW: { ackHours: 24, resolveHours: 168 },
    MEDIUM: { ackHours: 12, resolveHours: 72 },
    HIGH: { ackHours: 4, resolveHours: 24 },
    CRITICAL: { ackHours: 2, resolveHours: 8 },
  },
  escalation: {
    /** G6 — student may escalate to the Warden after this many hours of inaction. */
    studentEscalateAfterHours: 24,
    /** G7 — student may flag a false resolution this long after it was marked resolved. */
    falseResolutionFlagAfterHours: 24,
    /** E2 — the sweep auto-escalates a complaint with no activity for this long. */
    autoEscalateStaleAfterHours: 24,
    /** E5 — level 1 -> level 2 after this many additional hours. */
    level2AfterHours: 48,
    /** E7 — auto-close a RESOLVED complaint after this long with no student response. */
    autoCloseResolvedAfterHours: 72,
    /** Warden may reopen a closed complaint within this many days. */
    wardenReopenWindowDays: 7,
    /** Minimum gap between two escalations of the same complaint. */
    escalationCooldownHours: 24,
  },
  priorityWeights: {
    ageMultiplier: 0.5,
    ageCapHours: 336,
    upvoteMultiplier: 2,
    upvoteCap: 50,
    escalationMultiplier: 75,
    reopenMultiplier: 40,
    resolveBreachBonus: 80,
    ackBreachBonus: 25,
    safetyBonus: 25,
    disputeBonus: 60,
  },
  attachments: {
    maxImages: 5,
    maxImageMb: 5,
    maxAudioMb: 10,
    maxAudioSeconds: 120,
  },
  policy: {
    /** Require at least one proof photo before a complaint can be marked resolved. */
    requireProofOnResolve: true,
    /** Allow students to file without revealing their name to other students. */
    allowAnonymous: true,
    /** Max complaints a single student may file per day. */
    maxComplaintsPerStudentPerDay: 5,
    /** Restrict registration to this e-mail domain ("" = any domain). */
    allowedEmailDomain: "",
  },
  /**
   * The department codes UET Narowal actually issues, confirmed by the client.
   * A registration number whose department is not on this list is rejected at
   * sign-up. The Coordinator can edit the list under System settings when a new
   * programme opens — nothing here is hard-coded into the regex.
   */
  departments: ["CS", "BSCPE", "EE", "ARCH", "CE", "ME", "BME"],
} as const;

/**
 * `DEFAULT_SETTINGS` is `as const`, so its inferred field types are the literal
 * default values (`true`, `5`, `""`). The settings document is edited at runtime
 * by the Coordinator, so the shape has to be the widened, mutable version of
 * those defaults — otherwise the only value a field could legally hold is the
 * one it shipped with.
 */
type Editable<T> = T extends readonly (infer Item)[]
  ? Editable<Item>[]
  : T extends boolean
    ? boolean
    : T extends number
      ? number
      : T extends string
        ? string
        : { -readonly [K in keyof T]: Editable<T[K]> };

export type SettingsShape = {
  sla: Record<Severity, { ackHours: number; resolveHours: number }>;
  escalation: Editable<typeof DEFAULT_SETTINGS.escalation>;
  priorityWeights: Editable<typeof DEFAULT_SETTINGS.priorityWeights>;
  attachments: Editable<typeof DEFAULT_SETTINGS.attachments>;
  policy: Editable<typeof DEFAULT_SETTINGS.policy>;
  departments: string[];
};
