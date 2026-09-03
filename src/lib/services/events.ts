import type { Types } from "mongoose";
import { ComplaintEvent } from "@/models";
import type { ComplaintStatus, EventAction, Role } from "@/lib/domain/constants";

/**
 * The only way anything is written to the audit trail. Append-only by contract:
 * there is deliberately no update or delete helper in this module.
 */

export type LogEventInput = {
  complaintId: Types.ObjectId | string;
  complaintCode: string;
  actor: { id?: string | null; name: string; role: Role | "SYSTEM" };
  action: EventAction;
  fromStatus?: ComplaintStatus | null;
  toStatus?: ComplaintStatus | null;
  message?: string;
  visibility?: "PUBLIC" | "INTERNAL";
  meta?: Record<string, unknown>;
  request?: Request;
};

export async function logEvent(input: LogEventInput): Promise<void> {
  const ip = input.request
    ? (input.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      input.request.headers.get("x-real-ip") ??
      undefined)
    : undefined;

  await ComplaintEvent.create({
    complaintId: input.complaintId,
    complaintCode: input.complaintCode,
    actorId: input.actor.id ?? null,
    actorName: input.actor.name,
    actorRole: input.actor.role,
    action: input.action,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
    message: input.message,
    visibility: input.visibility ?? "PUBLIC",
    meta: input.meta,
    ip,
    userAgent: input.request?.headers.get("user-agent") ?? undefined,
  });
}

export const SYSTEM_ACTOR = { id: null, name: "System", role: "SYSTEM" as const };

/** Sentence rendered in the timeline for each action type. */
export function describeEvent(e: {
  action: EventAction;
  actorName: string;
  actorRole: Role | "SYSTEM";
  fromStatus?: ComplaintStatus | null;
  toStatus?: ComplaintStatus | null;
  meta?: Record<string, unknown>;
}): string {
  const who = e.actorRole === "SYSTEM" ? "The system" : e.actorName;

  switch (e.action) {
    case "CREATED":
      return `${who} filed this complaint`;
    case "STATUS_CHANGED":
      return `${who} changed the status`;
    case "SEVERITY_CHANGED":
      return `${who} changed the severity`;
    case "CATEGORY_CHANGED":
      return `${who} changed the category`;
    case "WORKER_ASSIGNED":
      return `${who} assigned ${(e.meta?.workerName as string) ?? "a worker"}`;
    case "WORKER_UNASSIGNED":
      return `${who} removed the assigned worker`;
    case "COMMENT_ADDED":
      return `${who} added a comment`;
    case "INTERNAL_NOTE_ADDED":
      return `${who} added an internal note`;
    case "ESCALATED":
      return `${who} escalated this to the ${(e.meta?.to as string) ?? "Warden"}`;
    case "FALSE_RESOLUTION_FLAGGED":
      return `${who} reported that the work was marked done but is still pending`;
    case "VERIFIED":
      return `${who} confirmed the problem is fixed`;
    case "REOPENED":
      return `${who} reopened this complaint`;
    case "REJECTED":
      return `${who} rejected this complaint`;
    case "UPVOTED":
      return `Another resident reported the same problem`;
    case "AUTO_CLOSED":
      return `Closed automatically — no response after resolution`;
    case "SLA_BREACHED":
      return `The resolution deadline was missed`;
    case "ATTACHMENT_ADDED":
      return `${who} added an attachment`;
    case "DUPLICATE_LINKED":
      return `${who} linked this to another complaint`;
    case "PRIORITY_RECOMPUTED":
      return `Priority recalculated`;
    default:
      return `${who} updated this complaint`;
  }
}
