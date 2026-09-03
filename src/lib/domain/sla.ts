/**
 * SLA clocks and escalation eligibility.
 *
 * Two clocks run on every open complaint:
 *   - acknowledgement clock: creation -> first staff response
 *   - resolution clock:      creation -> RESOLVED
 *
 * Escalation eligibility (G6/G7) is computed here so the API and the UI always
 * agree on whether a button should be enabled.
 */
import {
  DEFAULT_SETTINGS,
  STATUS_META,
  type ComplaintStatus,
  type Severity,
  type SettingsShape,
} from "./constants";

const HOUR = 3_600_000;

export type SlaState = {
  ackDueAt: Date;
  resolveDueAt: Date;
  ackBreached: boolean;
  resolveBreached: boolean;
  firstResponseAt?: Date | null;
};

export function computeSlaDueDates(
  createdAt: Date,
  severity: Severity,
  settings: Pick<SettingsShape, "sla"> = DEFAULT_SETTINGS as unknown as SettingsShape,
): { ackDueAt: Date; resolveDueAt: Date } {
  const rule = settings.sla[severity] ?? DEFAULT_SETTINGS.sla[severity];
  return {
    ackDueAt: new Date(createdAt.getTime() + rule.ackHours * HOUR),
    resolveDueAt: new Date(createdAt.getTime() + rule.resolveHours * HOUR),
  };
}

/**
 * Recompute breach flags. Once a complaint has been acknowledged the ack clock
 * stops; once it is resolved or closed the resolve clock stops.
 */
export function evaluateBreaches(
  sla: { ackDueAt: Date; resolveDueAt: Date; firstResponseAt?: Date | null },
  status: ComplaintStatus,
  now: Date = new Date(),
): { ackBreached: boolean; resolveBreached: boolean } {
  const ackStopped = Boolean(sla.firstResponseAt);
  const resolveStopped = !STATUS_META[status].isOpen || status === "RESOLVED";

  const ackBreached = ackStopped
    ? (sla.firstResponseAt as Date).getTime() > sla.ackDueAt.getTime()
    : now.getTime() > sla.ackDueAt.getTime();

  const resolveBreached = resolveStopped ? false : now.getTime() > sla.resolveDueAt.getTime();

  return { ackBreached, resolveBreached };
}

export type SlaHealth = "ON_TRACK" | "DUE_SOON" | "BREACHED" | "STOPPED";

export function slaHealth(dueAt: Date, stopped: boolean, now: Date = new Date()): SlaHealth {
  if (stopped) return "STOPPED";
  const remaining = dueAt.getTime() - now.getTime();
  if (remaining < 0) return "BREACHED";
  if (remaining < 4 * HOUR) return "DUE_SOON";
  return "ON_TRACK";
}

export function timeRemaining(dueAt: Date, now: Date = new Date()): string {
  const ms = dueAt.getTime() - now.getTime();
  const abs = Math.abs(ms);
  const h = Math.floor(abs / HOUR);
  const m = Math.floor((abs % HOUR) / 60_000);

  let text: string;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    text = `${d}d ${h % 24}h`;
  } else if (h >= 1) {
    text = `${h}h ${m}m`;
  } else {
    text = `${m}m`;
  }
  return ms < 0 ? `${text} overdue` : `${text} left`;
}

/* ---------------------------------------------------------------------------
 * Ageing buckets — used by dashboards
 * ------------------------------------------------------------------------ */

export const AGE_BUCKETS = [
  { key: "lt24h", label: "Under 24 h", maxHours: 24 },
  { key: "d1_3", label: "1-3 days", maxHours: 72 },
  { key: "d3_7", label: "3-7 days", maxHours: 168 },
  { key: "gt7d", label: "Over 7 days", maxHours: Infinity },
] as const;

export type AgeBucketKey = (typeof AGE_BUCKETS)[number]["key"];

export function ageBucket(createdAt: Date, now: Date = new Date()): AgeBucketKey {
  const hours = (now.getTime() - createdAt.getTime()) / HOUR;
  for (const b of AGE_BUCKETS) {
    if (hours < b.maxHours) return b.key;
  }
  return "gt7d";
}

/* ---------------------------------------------------------------------------
 * Escalation eligibility (G6 / G7)
 * ------------------------------------------------------------------------ */

export type EscalationEligibility = {
  /** Can the student escalate to the Warden right now? */
  canEscalate: boolean;
  /** Why not — shown as helper text under the disabled button. */
  escalateReason: string;
  /** When it becomes possible (null when already possible or never). */
  escalateAvailableAt: Date | null;

  /** Can the student flag the resolution as false right now? */
  canFlagFalseResolution: boolean;
  flagReason: string;
  flagAvailableAt: Date | null;
};

export type EscalationInput = {
  status: ComplaintStatus;
  createdAt: Date;
  lastActivityAt: Date;
  escalationLevel: number;
  lastEscalatedAt?: Date | null;
  resolvedAt?: Date | null;
  isDisputed?: boolean;
};

export function evaluateEscalation(
  c: EscalationInput,
  settings: Pick<SettingsShape, "escalation"> = DEFAULT_SETTINGS as unknown as SettingsShape,
  now: Date = new Date(),
): EscalationEligibility {
  const cfg = settings.escalation ?? DEFAULT_SETTINGS.escalation;

  const result: EscalationEligibility = {
    canEscalate: false,
    escalateReason: "",
    escalateAvailableAt: null,
    canFlagFalseResolution: false,
    flagReason: "",
    flagAvailableAt: null,
  };

  /* ---- G6: escalate an ignored complaint to the Warden ---- */
  const escalateAt = new Date(c.createdAt.getTime() + cfg.studentEscalateAfterHours * HOUR);

  if (!STATUS_META[c.status].isOpen) {
    result.escalateReason = "This complaint is closed.";
  } else if (c.status === "RESOLVED") {
    result.escalateReason =
      "This complaint is marked resolved. If it is not actually fixed, report it instead.";
  } else if (c.escalationLevel >= 2) {
    result.escalateReason = "Already escalated to the Campus Coordinator.";
  } else if (c.lastEscalatedAt && now.getTime() - c.lastEscalatedAt.getTime() < cfg.escalationCooldownHours * HOUR) {
    const next = new Date(c.lastEscalatedAt.getTime() + cfg.escalationCooldownHours * HOUR);
    result.escalateReason = `Already escalated recently. You can escalate again after ${next.toLocaleString()}.`;
    result.escalateAvailableAt = next;
  } else if (now < escalateAt) {
    result.escalateReason = `You can escalate to the Warden ${cfg.studentEscalateAfterHours} hours after filing, if nothing has happened.`;
    result.escalateAvailableAt = escalateAt;
  } else {
    result.canEscalate = true;
    result.escalateReason =
      c.escalationLevel === 0
        ? "No action for over 24 hours — you can escalate this to the Hostel Warden."
        : "Still unresolved — you can escalate this to the Campus Coordinator.";
  }

  /* ---- G7: flag a false resolution ---- */
  if (c.status !== "RESOLVED" || !c.resolvedAt) {
    result.flagReason = "Only available once staff have marked this complaint resolved.";
  } else if (c.isDisputed) {
    result.flagReason = "You have already reported this. The Warden has been notified.";
  } else {
    const flagAt = new Date(c.resolvedAt.getTime() + cfg.falseResolutionFlagAfterHours * HOUR);
    if (now < flagAt) {
      result.flagReason = `If the work is still not done ${cfg.falseResolutionFlagAfterHours} hours after it was marked resolved, you can report it to the Warden.`;
      result.flagAvailableAt = flagAt;
    } else {
      result.canFlagFalseResolution = true;
      result.flagReason =
        "It has been over 24 hours since this was marked resolved. If the work is still pending, report it to the Hostel Warden.";
    }
  }

  return result;
}

/** Auto-close deadline for a resolved complaint (E7). */
export function autoCloseAt(
  resolvedAt: Date,
  settings: Pick<SettingsShape, "escalation"> = DEFAULT_SETTINGS as unknown as SettingsShape,
): Date {
  const hours =
    settings.escalation?.autoCloseResolvedAfterHours ??
    DEFAULT_SETTINGS.escalation.autoCloseResolvedAfterHours;
  return new Date(resolvedAt.getTime() + hours * HOUR);
}
