/**
 * Priority engine.
 *
 * The whole point of the system: an older complaint and a more severe complaint
 * must both float to the top of the queue. `priorityScore` is denormalised onto
 * the complaint so MongoDB can sort and paginate on it.
 *
 * Recomputed on: creation, every status/severity change, every upvote,
 * every escalation, and by the scheduled sweep (which is what makes *age* move).
 */
import {
  CATEGORY_META,
  DEFAULT_SETTINGS,
  SEVERITY_META,
  STATUS_META,
  type Category,
  type ComplaintStatus,
  type SettingsShape,
  type Severity,
} from "./constants";

export type PriorityInput = {
  severity: Severity;
  category: Category;
  status: ComplaintStatus;
  createdAt: Date | string;
  upvoteCount?: number;
  escalationLevel?: number;
  reopenCount?: number;
  isDisputed?: boolean;
  sla?: { ackBreached?: boolean; resolveBreached?: boolean };
};

export type PriorityBreakdown = {
  total: number;
  severity: number;
  age: number;
  upvotes: number;
  escalation: number;
  reopen: number;
  sla: number;
  safety: number;
  dispute: number;
  ageHours: number;
};

type Weights = SettingsShape["priorityWeights"];

export function hoursSince(date: Date | string, now: Date = new Date()): number {
  const then = date instanceof Date ? date : new Date(date);
  return Math.max(0, (now.getTime() - then.getTime()) / 3_600_000);
}

/**
 * Full breakdown, used both for the stored score and for the "why is this at the
 * top?" tooltip in the staff queue — transparency about the ranking itself.
 */
export function computePriorityBreakdown(
  input: PriorityInput,
  weights: Weights = DEFAULT_SETTINGS.priorityWeights,
  now: Date = new Date(),
): PriorityBreakdown {
  const ageHours = hoursSince(input.createdAt, now);

  // Closed complaints never compete for attention.
  if (!STATUS_META[input.status].isOpen) {
    return {
      total: 0,
      severity: 0,
      age: 0,
      upvotes: 0,
      escalation: 0,
      reopen: 0,
      sla: 0,
      safety: 0,
      dispute: 0,
      ageHours,
    };
  }

  const severity = SEVERITY_META[input.severity].weight;

  const age = Math.min(ageHours, weights.ageCapHours) * weights.ageMultiplier;

  const upvotes =
    Math.min(input.upvoteCount ?? 0, weights.upvoteCap) * weights.upvoteMultiplier;

  const escalation = (input.escalationLevel ?? 0) * weights.escalationMultiplier;

  const reopen = (input.reopenCount ?? 0) * weights.reopenMultiplier;

  const sla =
    (input.sla?.resolveBreached ? weights.resolveBreachBonus : 0) +
    (input.sla?.ackBreached ? weights.ackBreachBonus : 0);

  const safety = CATEGORY_META[input.category].isSafety ? weights.safetyBonus : 0;

  const dispute = input.isDisputed ? weights.disputeBonus : 0;

  const total = severity + age + upvotes + escalation + reopen + sla + safety + dispute;

  return {
    total: Math.round(total * 100) / 100,
    severity,
    age: Math.round(age * 100) / 100,
    upvotes,
    escalation,
    reopen,
    sla,
    safety,
    dispute,
    ageHours: Math.round(ageHours * 10) / 10,
  };
}

export function computePriorityScore(
  input: PriorityInput,
  weights: Weights = DEFAULT_SETTINGS.priorityWeights,
  now: Date = new Date(),
): number {
  return computePriorityBreakdown(input, weights, now).total;
}

/** Coarse band used for colour-coding the queue. */
export type PriorityBand = "ROUTINE" | "ELEVATED" | "URGENT" | "CRITICAL";

export function priorityBand(score: number): PriorityBand {
  if (score >= 260) return "CRITICAL";
  if (score >= 160) return "URGENT";
  if (score >= 80) return "ELEVATED";
  return "ROUTINE";
}

export const PRIORITY_BAND_META: Record<
  PriorityBand,
  { label: string; tone: "neutral" | "info" | "warning" | "danger" }
> = {
  ROUTINE: { label: "Routine", tone: "neutral" },
  ELEVATED: { label: "Elevated", tone: "info" },
  URGENT: { label: "Urgent", tone: "warning" },
  CRITICAL: { label: "Critical", tone: "danger" },
};

/** Plain-English explanation of a score, for the staff queue tooltip. */
export function explainPriority(b: PriorityBreakdown): string[] {
  const parts: string[] = [];
  if (b.severity) parts.push(`Severity +${b.severity}`);
  if (b.age) parts.push(`Waiting ${formatAge(b.ageHours)} +${b.age.toFixed(0)}`);
  if (b.upvotes) parts.push(`Other students affected +${b.upvotes}`);
  if (b.escalation) parts.push(`Escalated +${b.escalation}`);
  if (b.reopen) parts.push(`Reopened +${b.reopen}`);
  if (b.sla) parts.push(`SLA breached +${b.sla}`);
  if (b.safety) parts.push(`Safety category +${b.safety}`);
  if (b.dispute) parts.push(`Disputed resolution +${b.dispute}`);
  return parts;
}

export function formatAge(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${Math.round(hours)} h`;
  const days = Math.floor(hours / 24);
  const rem = Math.round(hours % 24);
  if (days < 7) return rem ? `${days} d ${rem} h` : `${days} d`;
  const weeks = Math.floor(days / 7);
  return `${weeks} w ${days % 7} d`;
}
