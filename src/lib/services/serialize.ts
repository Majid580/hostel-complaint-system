import type { IComplaint, IComplaintEvent } from "@/models";
import type { CurrentUser } from "@/lib/auth/session";
import { canSeeInternalNotes, canSeeReporterIdentity } from "@/lib/auth/permissions";
import { computePriorityBreakdown, explainPriority } from "@/lib/domain/priority";
import { evaluateEscalation } from "@/lib/domain/sla";
import { availableTransitions, type TransitionActor } from "@/lib/domain/statusMachine";
import { describeEvent } from "./events";
import type { SettingsShape } from "@/lib/domain/constants";
import { maskRegNo } from "@/lib/domain/regNo";

/**
 * Turns a Mongoose document into the JSON a *specific viewer* is allowed to see.
 * All identity masking, internal-note filtering and action gating happens here,
 * so no route can accidentally leak more than it should.
 */

type Lean = IComplaint & { _id: unknown };

export type SerializedComplaint = ReturnType<typeof serializeComplaint>;

export function serializeComplaint(
  c: Lean,
  viewer: CurrentUser,
  settings: SettingsShape,
  options: { includeActions?: boolean } = {},
) {
  const scope = { hostel: c.hostel, studentUserId: String(c.student.userId) };
  const showIdentity = canSeeReporterIdentity(viewer, scope, c.isAnonymous);
  const isReporter = String(c.student.userId) === viewer.id;

  const breakdown = computePriorityBreakdown(
    {
      severity: c.severity,
      category: c.category,
      status: c.status,
      createdAt: c.createdAt,
      upvoteCount: c.upvoteCount,
      escalationLevel: c.escalationLevel,
      reopenCount: c.reopenCount,
      isDisputed: c.isDisputed,
      sla: c.sla,
    },
    settings.priorityWeights,
  );

  const escalation = evaluateEscalation(
    {
      status: c.status,
      createdAt: new Date(c.createdAt),
      lastActivityAt: new Date(c.lastActivityAt),
      escalationLevel: c.escalationLevel,
      lastEscalatedAt: c.lastEscalatedAt ? new Date(c.lastEscalatedAt) : null,
      resolvedAt: c.resolution?.resolvedAt ? new Date(c.resolution.resolvedAt) : null,
      isDisputed: c.isDisputed,
    },
    settings,
  );

  return {
    id: String(c._id),
    code: c.code,
    title: c.title,
    description: c.description,
    hostel: c.hostel,
    category: c.category,
    severity: c.severity,
    status: c.status,
    location: c.location ?? null,
    priorityScore: c.priorityScore,
    priorityReasons: explainPriority(breakdown),
    ageHours: breakdown.ageHours,
    escalationLevel: c.escalationLevel,
    isDisputed: c.isDisputed,
    isAnonymous: c.isAnonymous,
    reopenCount: c.reopenCount,
    upvoteCount: c.upvoteCount,
    hasUpvoted: c.upvotes?.some((id) => String(id) === viewer.id) ?? false,

    student: showIdentity
      ? {
          id: String(c.student.userId),
          name: c.student.name,
          regNo: c.student.regNo,
          email: viewer.role === "STUDENT" && !isReporter ? null : c.student.email,
          phone: viewer.role === "STUDENT" ? null : (c.student.phone ?? null),
          roomNo: c.student.roomNo ?? null,
        }
      : {
          id: null,
          name: "Anonymous resident",
          regNo: maskRegNo(c.student.regNo),
          email: null,
          phone: null,
          roomNo: null,
        },

    images: c.images ?? [],
    audio: c.audio ?? null,

    assignment: c.assignment
      ? {
          workerId: String(c.assignment.workerId),
          workerName: c.assignment.workerName,
          // Students do not get the worker's personal phone number.
          workerPhone: viewer.role === "STUDENT" ? null : (c.assignment.workerPhone ?? null),
          trade: c.assignment.trade,
          assignedByName: c.assignment.assignedByName,
          assignedAt: c.assignment.assignedAt,
          expectedCompletionAt: c.assignment.expectedCompletionAt ?? null,
          startedAt: c.assignment.startedAt ?? null,
          completedAt: c.assignment.completedAt ?? null,
          remarks: c.assignment.remarks ?? null,
        }
      : null,

    resolution: c.resolution
      ? {
          resolvedByName: c.resolution.resolvedByName,
          resolvedByRole: c.resolution.resolvedByRole,
          resolvedAt: c.resolution.resolvedAt,
          note: c.resolution.note,
          proofImages: c.resolution.proofImages ?? [],
        }
      : null,

    verification: c.verification
      ? {
          verifiedAt: c.verification.verifiedAt,
          method: c.verification.method,
          rating: c.verification.rating ?? null,
          feedback: c.verification.feedback ?? null,
        }
      : null,

    rejection: c.rejection
      ? {
          rejectedByName: c.rejection.rejectedByName,
          rejectedAt: c.rejection.rejectedAt,
          reason: c.rejection.reason,
        }
      : null,

    onHold: c.onHold
      ? { reason: c.onHold.reason, until: c.onHold.until ?? null, setAt: c.onHold.setAt }
      : null,

    sla: {
      ackDueAt: c.sla.ackDueAt,
      resolveDueAt: c.sla.resolveDueAt,
      ackBreached: c.sla.ackBreached,
      resolveBreached: c.sla.resolveBreached,
      firstResponseAt: c.sla.firstResponseAt ?? null,
    },

    escalation: {
      canEscalate: isReporter && escalation.canEscalate,
      escalateReason: escalation.escalateReason,
      escalateAvailableAt: escalation.escalateAvailableAt,
      canFlagFalseResolution: isReporter && escalation.canFlagFalseResolution,
      flagReason: escalation.flagReason,
      flagAvailableAt: escalation.flagAvailableAt,
    },

    /** Buttons the viewer is allowed to press right now. */
    actions: options.includeActions
      ? availableTransitions(c.status, viewer.role as TransitionActor).map((t) => ({
          to: t.to,
          label: t.label,
          description: t.description,
          intent: t.intent ?? "default",
          requires: t.requires ?? {},
        }))
      : undefined,

    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    lastActivityAt: c.lastActivityAt,
  };
}

/** Compact shape for list views — keeps payloads small on a mobile connection. */
export function serializeComplaintRow(c: Lean, viewer: CurrentUser) {
  const showIdentity = canSeeReporterIdentity(
    viewer,
    { hostel: c.hostel, studentUserId: String(c.student.userId) },
    c.isAnonymous,
  );

  return {
    id: String(c._id),
    code: c.code,
    title: c.title,
    hostel: c.hostel,
    category: c.category,
    severity: c.severity,
    status: c.status,
    priorityScore: c.priorityScore,
    escalationLevel: c.escalationLevel,
    isDisputed: c.isDisputed,
    upvoteCount: c.upvoteCount,
    imageCount: c.images?.length ?? 0,
    hasAudio: Boolean(c.audio),
    location: c.location ?? null,
    student: {
      name: showIdentity ? c.student.name : "Anonymous resident",
      regNo: showIdentity ? c.student.regNo : maskRegNo(c.student.regNo),
      roomNo: showIdentity ? (c.student.roomNo ?? null) : null,
    },
    assignedTo: c.assignment?.workerName ?? null,
    sla: {
      resolveDueAt: c.sla.resolveDueAt,
      resolveBreached: c.sla.resolveBreached,
      ackBreached: c.sla.ackBreached,
      firstResponseAt: c.sla.firstResponseAt ?? null,
    },
    createdAt: c.createdAt,
    lastActivityAt: c.lastActivityAt,
  };
}

export function serializeTimeline(
  events: (IComplaintEvent & { _id: unknown })[],
  viewer: CurrentUser,
) {
  const canSeeInternal = canSeeInternalNotes(viewer);

  return events
    .filter((e) => canSeeInternal || e.visibility === "PUBLIC")
    .map((e) => ({
      id: String(e._id),
      action: e.action,
      actorName: e.actorName,
      actorRole: e.actorRole,
      fromStatus: e.fromStatus ?? null,
      toStatus: e.toStatus ?? null,
      message: e.message ?? null,
      visibility: e.visibility,
      summary: describeEvent(e),
      meta: e.meta ?? null,
      createdAt: e.createdAt,
    }));
}
