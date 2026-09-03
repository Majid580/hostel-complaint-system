/**
 * Complaint state machine — the single place that decides whether a status
 * change is legal, who may perform it, and what payload it requires.
 *
 * Every mutating route funnels through `evaluateTransition`. There is no other
 * legitimate way to change `complaint.status`.
 */
import type { ComplaintStatus, Role } from "./constants";
import { STATUS_META } from "./constants";

export type TransitionActor = Role | "SYSTEM";

export type TransitionRule = {
  to: ComplaintStatus;
  /** Roles allowed to perform this transition. */
  actors: readonly TransitionActor[];
  /** Human label shown on the action button. */
  label: string;
  /** Short sentence explaining the consequence, shown in the confirm dialog. */
  description: string;
  /** Payload requirements enforced server-side. */
  requires?: {
    note?: boolean;
    proofImages?: boolean;
    worker?: boolean;
    holdUntil?: boolean;
    reason?: boolean;
  };
  /** Visual intent for the action button. */
  intent?: "default" | "primary" | "success" | "warning" | "danger";
};

const STAFF: readonly TransitionActor[] = ["RT", "WARDEN", "COORDINATOR"];
const GLOBAL_STAFF: readonly TransitionActor[] = ["WARDEN", "COORDINATOR"];

export const TRANSITIONS: Record<ComplaintStatus, readonly TransitionRule[]> = {
  SUBMITTED: [
    {
      to: "ACKNOWLEDGED",
      actors: STAFF,
      label: "Acknowledge",
      description: "Confirms you have seen this complaint. Stops the acknowledgement SLA clock.",
      intent: "primary",
    },
    {
      to: "ASSIGNED",
      actors: STAFF,
      label: "Assign worker",
      description: "Acknowledges and assigns a worker in one step.",
      requires: { worker: true },
      intent: "primary",
    },
    {
      to: "REJECTED",
      actors: STAFF,
      label: "Reject",
      description: "Closes the complaint as not actionable. A written reason is required and visible to the student.",
      requires: { reason: true },
      intent: "danger",
    },
  ],

  ACKNOWLEDGED: [
    {
      to: "ASSIGNED",
      actors: STAFF,
      label: "Assign worker",
      description: "Assign a worker and an expected completion date.",
      requires: { worker: true },
      intent: "primary",
    },
    {
      to: "IN_PROGRESS",
      actors: STAFF,
      label: "Mark in progress",
      description: "Work has started.",
      intent: "warning",
    },
    {
      to: "ON_HOLD",
      actors: STAFF,
      label: "Put on hold",
      description: "Pauses the complaint. A reason and a resume date are required and shown to the student.",
      requires: { reason: true, holdUntil: true },
    },
    {
      to: "RESOLVED",
      actors: STAFF,
      label: "Mark resolved",
      description: "Notifies the student to confirm the fix. Proof photo and a note are required.",
      requires: { note: true, proofImages: true },
      intent: "success",
    },
    {
      to: "REJECTED",
      actors: STAFF,
      label: "Reject",
      description: "Closes the complaint as not actionable. A written reason is required.",
      requires: { reason: true },
      intent: "danger",
    },
  ],

  ASSIGNED: [
    {
      to: "IN_PROGRESS",
      actors: STAFF,
      label: "Mark in progress",
      description: "The assigned worker has started the job.",
      intent: "warning",
    },
    {
      to: "ON_HOLD",
      actors: STAFF,
      label: "Put on hold",
      description: "Pauses the complaint. A reason and a resume date are required.",
      requires: { reason: true, holdUntil: true },
    },
    {
      to: "RESOLVED",
      actors: STAFF,
      label: "Mark resolved",
      description: "Notifies the student to confirm the fix. Proof photo and a note are required.",
      requires: { note: true, proofImages: true },
      intent: "success",
    },
    {
      to: "ACKNOWLEDGED",
      actors: STAFF,
      label: "Unassign worker",
      description: "Removes the current worker and returns the complaint to the queue.",
    },
  ],

  IN_PROGRESS: [
    {
      to: "RESOLVED",
      actors: STAFF,
      label: "Mark resolved",
      description: "Notifies the student to confirm the fix. Proof photo and a note are required.",
      requires: { note: true, proofImages: true },
      intent: "success",
    },
    {
      to: "ON_HOLD",
      actors: STAFF,
      label: "Put on hold",
      description: "Pauses the complaint. A reason and a resume date are required.",
      requires: { reason: true, holdUntil: true },
    },
    {
      to: "ASSIGNED",
      actors: STAFF,
      label: "Reassign worker",
      description: "Hand the job to a different worker.",
      requires: { worker: true },
    },
  ],

  ON_HOLD: [
    {
      to: "ACKNOWLEDGED",
      actors: STAFF,
      label: "Resume",
      description: "Takes the complaint off hold and back into the queue.",
      intent: "primary",
    },
    {
      to: "ASSIGNED",
      actors: STAFF,
      label: "Resume and assign",
      description: "Takes it off hold and assigns a worker.",
      requires: { worker: true },
      intent: "primary",
    },
    {
      to: "IN_PROGRESS",
      actors: STAFF,
      label: "Resume work",
      description: "Work has restarted.",
      intent: "warning",
    },
    {
      to: "REJECTED",
      actors: STAFF,
      label: "Reject",
      description: "Closes the complaint as not actionable. A written reason is required.",
      requires: { reason: true },
      intent: "danger",
    },
  ],

  RESOLVED: [
    {
      to: "VERIFIED_CLOSED",
      actors: ["STUDENT", "WARDEN", "COORDINATOR", "SYSTEM"],
      label: "Confirm and close",
      description: "Confirms the problem is genuinely fixed and closes the complaint.",
      intent: "success",
    },
    {
      to: "REOPENED",
      actors: ["STUDENT", "WARDEN", "COORDINATOR"],
      label: "Still not fixed",
      description: "Reopens the complaint and notifies staff that the work is incomplete.",
      requires: { reason: true },
      intent: "danger",
    },
  ],

  REOPENED: [
    {
      to: "ACKNOWLEDGED",
      actors: STAFF,
      label: "Acknowledge",
      description: "Confirms you have seen the reopened complaint.",
      intent: "primary",
    },
    {
      to: "ASSIGNED",
      actors: STAFF,
      label: "Assign worker",
      description: "Assign a worker to fix it properly this time.",
      requires: { worker: true },
      intent: "primary",
    },
    {
      to: "IN_PROGRESS",
      actors: STAFF,
      label: "Mark in progress",
      description: "Work has restarted.",
      intent: "warning",
    },
    {
      to: "RESOLVED",
      actors: STAFF,
      label: "Mark resolved",
      description: "Notifies the student to confirm. Proof photo and a note are required.",
      requires: { note: true, proofImages: true },
      intent: "success",
    },
  ],

  VERIFIED_CLOSED: [
    {
      to: "REOPENED",
      actors: GLOBAL_STAFF,
      label: "Force reopen",
      description: "Warden/Coordinator override — reopens a closed complaint. A reason is required.",
      requires: { reason: true },
      intent: "danger",
    },
  ],

  REJECTED: [
    {
      to: "ACKNOWLEDGED",
      actors: GLOBAL_STAFF,
      label: "Overturn rejection",
      description: "Warden/Coordinator override — puts a rejected complaint back into the queue.",
      requires: { reason: true },
      intent: "warning",
    },
  ],
};

export type TransitionCheck =
  | { ok: true; rule: TransitionRule }
  | { ok: false; code: "ILLEGAL_TRANSITION" | "FORBIDDEN_ACTOR"; message: string };

/** Is `from -> to` a legal transition for this actor? */
export function evaluateTransition(
  from: ComplaintStatus,
  to: ComplaintStatus,
  actor: TransitionActor,
): TransitionCheck {
  if (from === to) {
    return {
      ok: false,
      code: "ILLEGAL_TRANSITION",
      message: `The complaint is already "${STATUS_META[to].label}".`,
    };
  }

  const rule = TRANSITIONS[from]?.find((r) => r.to === to);
  if (!rule) {
    return {
      ok: false,
      code: "ILLEGAL_TRANSITION",
      message: `Cannot move a complaint from "${STATUS_META[from].label}" to "${STATUS_META[to].label}".`,
    };
  }

  if (!rule.actors.includes(actor)) {
    return {
      ok: false,
      code: "FORBIDDEN_ACTOR",
      message: `Your role is not allowed to perform "${rule.label}".`,
    };
  }

  return { ok: true, rule };
}

/** Transitions this actor may perform right now — used to render action buttons. */
export function availableTransitions(
  from: ComplaintStatus,
  actor: TransitionActor,
): TransitionRule[] {
  return (TRANSITIONS[from] ?? []).filter((r) => r.actors.includes(actor));
}

/** Ordered stages for the progress stepper shown to students. */
export const STEPPER_STAGES = [
  { stage: 0, label: "Submitted" },
  { stage: 1, label: "Acknowledged" },
  { stage: 2, label: "Assigned" },
  { stage: 3, label: "In progress" },
  { stage: 4, label: "Resolved" },
  { stage: 5, label: "Closed" },
] as const;
