import type { HydratedDocument } from "mongoose";
import { Complaint, Worker, type IAttachment, type IComplaint } from "@/models";
import { ApiError } from "@/lib/api/response";
import { logEvent } from "./events";
import { getSettings } from "./settings";
import { queueMail, notifyInApp, notifyManyInApp, resolveStaffRecipients } from "./notify";
import {
  escalationForStaff,
  falseResolutionForStaff,
  resolvedForStudent,
  statusChangedForStudent,
  workerAssignedForStudent,
} from "@/lib/mail/templates";
import { computePriorityScore } from "@/lib/domain/priority";
import { computeSlaDueDates, evaluateBreaches, evaluateEscalation } from "@/lib/domain/sla";
import { evaluateTransition, type TransitionActor } from "@/lib/domain/statusMachine";
import { STATUS_META, TRADE_LABEL, type ComplaintStatus } from "@/lib/domain/constants";
import type { CurrentUser } from "@/lib/auth/session";
import { canMutateComplaint, canViewComplaint } from "@/lib/auth/permissions";

type ComplaintDoc = HydratedDocument<IComplaint>;

/* ---------------------------------------------------------------------------
 * Shared helpers
 * ------------------------------------------------------------------------ */

export function complaintScope(c: Pick<IComplaint, "hostel" | "student">) {
  return { hostel: c.hostel, studentUserId: String(c.student.userId) };
}

export function assertCanView(actor: CurrentUser, c: ComplaintDoc | IComplaint) {
  if (!canViewComplaint(actor, complaintScope(c))) {
    throw new ApiError("NOT_FOUND", "Complaint not found.");
  }
}

export function assertCanMutate(actor: CurrentUser, c: ComplaintDoc | IComplaint) {
  if (!canMutateComplaint(actor, complaintScope(c))) {
    throw new ApiError(
      "FORBIDDEN",
      actor.role === "RT"
        ? "You can only act on complaints from your own hostel."
        : "You do not have permission to do that.",
    );
  }
}

/** Recomputes SLA breach flags and the denormalised priority score in place. */
export async function refreshDerived(c: ComplaintDoc, now = new Date()): Promise<void> {
  const settings = await getSettings();

  const breaches = evaluateBreaches(
    {
      ackDueAt: c.sla.ackDueAt,
      resolveDueAt: c.sla.resolveDueAt,
      firstResponseAt: c.sla.firstResponseAt,
    },
    c.status,
    now,
  );
  c.sla.ackBreached = breaches.ackBreached;
  c.sla.resolveBreached = breaches.resolveBreached;

  c.priorityScore = computePriorityScore(
    {
      severity: c.severity,
      category: c.category,
      status: c.status,
      createdAt: c.createdAt,
      upvoteCount: c.upvoteCount,
      escalationLevel: c.escalationLevel,
      reopenCount: c.reopenCount,
      isDisputed: c.isDisputed,
      sla: { ackBreached: c.sla.ackBreached, resolveBreached: c.sla.resolveBreached },
    },
    settings.priorityWeights,
    now,
  );
}

function summaryFor(c: ComplaintDoc) {
  return {
    code: c.code,
    title: c.title,
    description: c.description,
    hostel: c.hostel,
    category: c.category,
    severity: c.severity,
    status: c.status,
    studentName: c.student.name,
    regNo: c.student.regNo,
    roomNo: c.student.roomNo,
    location: c.location,
    createdAt: c.createdAt,
    imageCount: c.images.length,
    hasAudio: Boolean(c.audio),
  };
}

/* ---------------------------------------------------------------------------
 * Status transitions — the single write path for `status`
 * ------------------------------------------------------------------------ */

export type TransitionPayload = {
  note?: string;
  reason?: string;
  holdUntil?: string;
  proofImages?: IAttachment[];
  workerId?: string;
  expectedCompletionAt?: string;
};

export async function transitionStatus(
  c: ComplaintDoc,
  to: ComplaintStatus,
  actor: CurrentUser,
  payload: TransitionPayload,
  request?: Request,
): Promise<ComplaintDoc> {
  const settings = await getSettings();
  const from = c.status;
  const now = new Date();

  const check = evaluateTransition(from, to, actor.role as TransitionActor);
  if (!check.ok) {
    throw new ApiError(
      check.code === "FORBIDDEN_ACTOR" ? "FORBIDDEN" : "ILLEGAL_TRANSITION",
      check.message,
    );
  }
  const rule = check.rule;

  /* ---- Guard the payload ---- */
  if (rule.requires?.reason && (payload.reason ?? "").trim().length < 10) {
    throw new ApiError("VALIDATION_ERROR", "A written reason of at least 10 characters is required.", {
      reason: "Please explain, in at least 10 characters.",
    });
  }
  if (rule.requires?.note && (payload.note ?? "").trim().length < 10) {
    throw new ApiError("VALIDATION_ERROR", "Describe what was done, in at least 10 characters.", {
      note: "Describe the work that was done.",
    });
  }
  if (
    rule.requires?.proofImages &&
    settings.policy.requireProofOnResolve &&
    (payload.proofImages ?? []).length === 0
  ) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "Attach at least one photo showing the completed work.",
      { proofImages: "A proof photo is required before marking this resolved." },
    );
  }
  if (rule.requires?.holdUntil && !payload.holdUntil) {
    throw new ApiError("VALIDATION_ERROR", "Choose the date you expect to resume.", {
      holdUntil: "Required.",
    });
  }
  if (rule.requires?.worker && !payload.workerId) {
    throw new ApiError("VALIDATION_ERROR", "Select a worker to assign.", {
      workerId: "Required.",
    });
  }

  /* ---- Apply ---- */
  const isStaffActor = actor.role !== "STUDENT";
  if (isStaffActor && !c.sla.firstResponseAt) c.sla.firstResponseAt = now;

  if (payload.workerId) {
    await attachWorker(c, payload.workerId, actor, payload.expectedCompletionAt, now);
  }

  switch (to) {
    case "RESOLVED": {
      c.resolution = {
        resolvedBy: actor.id as never,
        resolvedByName: actor.name,
        resolvedByRole: actor.role,
        resolvedAt: now,
        note: payload.note!.trim(),
        proofImages: payload.proofImages ?? [],
      };
      if (c.assignment) c.assignment.completedAt = now;
      c.onHold = null;
      await bumpWorkerCompletion(c, now);
      break;
    }
    case "VERIFIED_CLOSED": {
      c.verification = {
        verifiedBy: actor.id as never,
        verifiedAt: now,
        method: actor.role === "STUDENT" ? "STUDENT" : "STAFF",
      };
      break;
    }
    case "REJECTED": {
      c.rejection = {
        rejectedBy: actor.id as never,
        rejectedByName: actor.name,
        rejectedAt: now,
        reason: payload.reason!.trim(),
      };
      break;
    }
    case "ON_HOLD": {
      c.onHold = {
        reason: payload.reason!.trim(),
        until: payload.holdUntil ? new Date(payload.holdUntil) : null,
        setBy: actor.id as never,
        setAt: now,
      };
      break;
    }
    case "REOPENED": {
      c.reopenCount += 1;
      c.onHold = null;
      c.verification = null;
      await bumpWorkerReopen(c);
      break;
    }
    case "IN_PROGRESS": {
      if (c.assignment && !c.assignment.startedAt) c.assignment.startedAt = now;
      c.onHold = null;
      break;
    }
    case "ACKNOWLEDGED": {
      // "Unassign worker" arrives here from ASSIGNED.
      if (from === "ASSIGNED" && !payload.workerId) c.assignment = null;
      c.onHold = null;
      break;
    }
    default:
      break;
  }

  c.status = to;
  c.lastActivityAt = now;
  await refreshDerived(c, now);
  await c.save();

  /* ---- Audit ---- */
  await logEvent({
    complaintId: c._id,
    complaintCode: c.code,
    actor: { id: actor.id, name: actor.name, role: actor.role },
    action: to === "REJECTED" ? "REJECTED" : to === "REOPENED" ? "REOPENED" : "STATUS_CHANGED",
    fromStatus: from,
    toStatus: to,
    message: payload.note?.trim() || payload.reason?.trim(),
    visibility: "PUBLIC",
    meta: { label: rule.label },
    request,
  });

  /* ---- Notify ---- */
  await notifyOnTransition(c, from, to, actor, payload);

  return c;
}

async function notifyOnTransition(
  c: ComplaintDoc,
  from: ComplaintStatus,
  to: ComplaintStatus,
  actor: CurrentUser,
  payload: TransitionPayload,
) {
  const link = `/student/complaints/${c._id}`;
  const summary = summaryFor(c);

  // The student is told about everything that happens to their complaint.
  if (actor.role !== "STUDENT") {
    if (to === "RESOLVED") {
      await queueMail(
        [c.student.email],
        resolvedForStudent(summary, String(c._id), {
          note: c.resolution?.note ?? "",
          by: actor.name,
          proofCount: c.resolution?.proofImages?.length ?? 0,
        }),
        { relatedComplaint: c._id },
      );
    } else {
      await queueMail(
        [c.student.email],
        statusChangedForStudent(
          summary,
          String(c._id),
          from,
          payload.note?.trim() || payload.reason?.trim(),
        ),
        { relatedComplaint: c._id },
      );
    }

    await notifyInApp(c.student.userId, {
      type: "STATUS_CHANGED",
      title: `${c.code} — ${STATUS_META[to].label}`,
      body: STATUS_META[to].description,
      link,
      tone: to === "RESOLVED" ? "success" : to === "REJECTED" ? "danger" : "info",
    });
  }

  // Staff are told when a student reopens something.
  if (actor.role === "STUDENT" && to === "REOPENED") {
    const recipients = await resolveStaffRecipients(c.hostel);
    await notifyManyInApp(
      recipients.allStaff.map((u) => u._id),
      {
        type: "REOPENED",
        title: `${c.code} reopened by the student`,
        body: payload.reason ?? "The student says the problem is not fixed.",
        link: `/staff/complaints/${c._id}`,
        tone: "danger",
      },
    );
  }
}

/* ---------------------------------------------------------------------------
 * Worker assignment
 * ------------------------------------------------------------------------ */

async function attachWorker(
  c: ComplaintDoc,
  workerId: string,
  actor: CurrentUser,
  expectedCompletionAt: string | undefined,
  now: Date,
) {
  const worker = await Worker.findById(workerId);
  if (!worker || !worker.isActive) {
    throw new ApiError("VALIDATION_ERROR", "That worker is not available.", {
      workerId: "Select an active worker.",
    });
  }
  if (!worker.hostels.includes(c.hostel)) {
    throw new ApiError("VALIDATION_ERROR", "That worker does not serve this hostel.", {
      workerId: "Not assigned to this hostel.",
    });
  }

  const previousWorkerId = c.assignment?.workerId ? String(c.assignment.workerId) : null;

  c.assignment = {
    workerId: worker._id,
    workerName: worker.name,
    workerPhone: worker.phone,
    trade: worker.trade,
    assignedBy: actor.id as never,
    assignedByName: actor.name,
    assignedAt: now,
    expectedCompletionAt: expectedCompletionAt ? new Date(expectedCompletionAt) : null,
    startedAt: c.assignment?.startedAt ?? null,
    completedAt: null,
    remarks: c.assignment?.remarks,
  };

  if (previousWorkerId !== String(worker._id)) {
    await Worker.updateOne({ _id: worker._id }, { $inc: { "stats.assigned": 1 } });
  }
}

export async function assignWorker(
  c: ComplaintDoc,
  input: { workerId: string; expectedCompletionAt?: string; remarks?: string },
  actor: CurrentUser,
  request?: Request,
): Promise<ComplaintDoc> {
  const now = new Date();
  await attachWorker(c, input.workerId, actor, input.expectedCompletionAt, now);
  if (input.remarks && c.assignment) c.assignment.remarks = input.remarks;

  if (!c.sla.firstResponseAt) c.sla.firstResponseAt = now;
  const from = c.status;
  if (c.status === "SUBMITTED" || c.status === "ACKNOWLEDGED" || c.status === "REOPENED") {
    c.status = "ASSIGNED";
  }
  c.lastActivityAt = now;
  await refreshDerived(c, now);
  await c.save();

  await logEvent({
    complaintId: c._id,
    complaintCode: c.code,
    actor: { id: actor.id, name: actor.name, role: actor.role },
    action: "WORKER_ASSIGNED",
    fromStatus: from,
    toStatus: c.status,
    message: input.remarks,
    meta: { workerName: c.assignment?.workerName, trade: c.assignment?.trade },
    request,
  });

  await queueMail(
    [c.student.email],
    workerAssignedForStudent(summaryFor(c), String(c._id), {
      name: c.assignment!.workerName,
      trade: TRADE_LABEL[c.assignment!.trade],
      expected: c.assignment!.expectedCompletionAt,
    }),
    { relatedComplaint: c._id },
  );

  await notifyInApp(c.student.userId, {
    type: "WORKER_ASSIGNED",
    title: `${c.code} — worker assigned`,
    body: `${c.assignment!.workerName} (${TRADE_LABEL[c.assignment!.trade]}) will attend to this.`,
    link: `/student/complaints/${c._id}`,
    tone: "info",
  });

  return c;
}

async function bumpWorkerCompletion(c: ComplaintDoc, now: Date) {
  if (!c.assignment?.workerId) return;
  const tatHours = (now.getTime() - c.assignment.assignedAt.getTime()) / 3_600_000;
  const onTime =
    !c.assignment.expectedCompletionAt || now <= c.assignment.expectedCompletionAt ? 1 : 0;

  await Worker.updateOne(
    { _id: c.assignment.workerId },
    {
      $inc: {
        "stats.completed": 1,
        "stats.onTime": onTime,
        "stats.totalTatHours": Math.max(0, tatHours),
      },
    },
  );
}

async function bumpWorkerReopen(c: ComplaintDoc) {
  if (!c.assignment?.workerId) return;
  await Worker.updateOne({ _id: c.assignment.workerId }, { $inc: { "stats.reopened": 1 } });
}

/* ---------------------------------------------------------------------------
 * G6 — escalate to the Warden after 24 hours of inaction
 * ------------------------------------------------------------------------ */

export async function escalateComplaint(
  c: ComplaintDoc,
  reason: string,
  actor: CurrentUser | { id: null; name: string; role: "SYSTEM" },
  request?: Request,
): Promise<ComplaintDoc> {
  const settings = await getSettings();
  const now = new Date();
  const isSystem = actor.role === "SYSTEM";

  if (!isSystem) {
    const eligibility = evaluateEscalation(
      {
        status: c.status,
        createdAt: c.createdAt,
        lastActivityAt: c.lastActivityAt,
        escalationLevel: c.escalationLevel,
        lastEscalatedAt: c.lastEscalatedAt,
        resolvedAt: c.resolution?.resolvedAt ?? null,
        isDisputed: c.isDisputed,
      },
      settings,
      now,
    );
    if (!eligibility.canEscalate) {
      throw new ApiError("FORBIDDEN", eligibility.escalateReason);
    }
  }

  const newLevel = (c.escalationLevel >= 1 ? 2 : 1) as 1 | 2;
  c.escalationLevel = newLevel;
  c.lastEscalatedAt = now;
  c.lastActivityAt = now;
  await refreshDerived(c, now);
  await c.save();

  await logEvent({
    complaintId: c._id,
    complaintCode: c.code,
    actor: { id: "id" in actor ? actor.id : null, name: actor.name, role: actor.role },
    action: "ESCALATED",
    message: reason,
    meta: { level: newLevel, to: newLevel === 1 ? "Hostel Warden" : "Campus Coordinator" },
    request,
  });

  const recipients = await resolveStaffRecipients(c.hostel);
  const targets =
    newLevel === 1
      ? [...recipients.wardens, ...recipients.rts]
      : [...recipients.coordinators, ...recipients.wardens];

  const hoursWaiting = (now.getTime() - c.createdAt.getTime()) / 3_600_000;

  await queueMail(
    targets.map((u) => u.email),
    escalationForStaff(summaryFor(c), String(c._id), {
      level: newLevel,
      reason,
      byName: actor.name,
      hoursWaiting,
    }),
    { relatedComplaint: c._id },
  );

  await notifyManyInApp(
    targets.map((u) => u._id),
    {
      type: "ESCALATED",
      title: `${c.code} escalated — action required`,
      body: reason,
      link: `/staff/complaints/${c._id}`,
      tone: "danger",
    },
  );

  await notifyInApp(c.student.userId, {
    type: "ESCALATED",
    title: `${c.code} escalated`,
    body: `Your complaint has been escalated to the ${newLevel === 1 ? "Hostel Warden" : "Campus Coordinator"}.`,
    link: `/student/complaints/${c._id}`,
    tone: "warning",
  });

  return c;
}

/* ---------------------------------------------------------------------------
 * G7 — "you marked it done, but it is not done"
 * ------------------------------------------------------------------------ */

export async function flagFalseResolution(
  c: ComplaintDoc,
  reason: string,
  actor: CurrentUser,
  request?: Request,
): Promise<ComplaintDoc> {
  const settings = await getSettings();
  const now = new Date();

  const eligibility = evaluateEscalation(
    {
      status: c.status,
      createdAt: c.createdAt,
      lastActivityAt: c.lastActivityAt,
      escalationLevel: c.escalationLevel,
      lastEscalatedAt: c.lastEscalatedAt,
      resolvedAt: c.resolution?.resolvedAt ?? null,
      isDisputed: c.isDisputed,
    },
    settings,
    now,
  );

  if (!eligibility.canFlagFalseResolution) {
    throw new ApiError("FORBIDDEN", eligibility.flagReason);
  }

  const resolvedBy = c.resolution?.resolvedByName ?? "Staff";
  const resolvedAt = c.resolution?.resolvedAt ?? now;
  const from = c.status;

  c.isDisputed = true;
  c.escalationLevel = c.escalationLevel >= 1 ? 2 : 1;
  c.lastEscalatedAt = now;
  c.status = "REOPENED";
  c.reopenCount += 1;
  c.verification = null;
  c.lastActivityAt = now;
  await bumpWorkerReopen(c);
  await refreshDerived(c, now);
  await c.save();

  await logEvent({
    complaintId: c._id,
    complaintCode: c.code,
    actor: { id: actor.id, name: actor.name, role: actor.role },
    action: "FALSE_RESOLUTION_FLAGGED",
    fromStatus: from,
    toStatus: "REOPENED",
    message: reason,
    meta: { resolvedBy, resolvedAt },
    request,
  });

  const recipients = await resolveStaffRecipients(c.hostel);
  const targets = [...recipients.wardens, ...recipients.coordinators, ...recipients.rts];

  await queueMail(
    targets.map((u) => u.email),
    falseResolutionForStaff(summaryFor(c), String(c._id), {
      studentName: c.student.name,
      reason,
      resolvedBy,
      resolvedAt,
    }),
    { relatedComplaint: c._id },
  );

  await notifyManyInApp(
    targets.map((u) => u._id),
    {
      type: "FALSE_RESOLUTION",
      title: `${c.code} — resolution disputed`,
      body: `${c.student.name} reports the work marked done by ${resolvedBy} is still pending.`,
      link: `/staff/complaints/${c._id}`,
      tone: "danger",
    },
  );

  return c;
}

/* ---------------------------------------------------------------------------
 * Student confirms the fix
 * ------------------------------------------------------------------------ */

export async function verifyResolution(
  c: ComplaintDoc,
  input: { rating?: number; feedback?: string },
  actor: CurrentUser,
  request?: Request,
): Promise<ComplaintDoc> {
  if (c.status !== "RESOLVED") {
    throw new ApiError(
      "ILLEGAL_TRANSITION",
      "You can only confirm a complaint that has been marked resolved.",
    );
  }

  const now = new Date();
  const from = c.status;

  c.status = "VERIFIED_CLOSED";
  c.verification = {
    verifiedBy: actor.id as never,
    verifiedAt: now,
    method: "STUDENT",
    rating: input.rating,
    feedback: input.feedback,
  };
  c.isDisputed = false;
  c.lastActivityAt = now;
  await refreshDerived(c, now);
  await c.save();

  await logEvent({
    complaintId: c._id,
    complaintCode: c.code,
    actor: { id: actor.id, name: actor.name, role: actor.role },
    action: "VERIFIED",
    fromStatus: from,
    toStatus: "VERIFIED_CLOSED",
    message: input.feedback,
    meta: { rating: input.rating },
    request,
  });

  const recipients = await resolveStaffRecipients(c.hostel);
  await notifyManyInApp(
    recipients.allStaff.map((u) => u._id),
    {
      type: "VERIFIED",
      title: `${c.code} confirmed fixed`,
      body: `${c.student.name} confirmed the work${input.rating ? ` and rated it ${input.rating}/5` : ""}.`,
      link: `/staff/complaints/${c._id}`,
      tone: "success",
    },
  );

  return c;
}

/* ---------------------------------------------------------------------------
 * "Me too" — other residents affected by the same problem
 * ------------------------------------------------------------------------ */

export async function toggleUpvote(
  c: ComplaintDoc,
  actor: CurrentUser,
  request?: Request,
): Promise<{ upvoted: boolean; count: number }> {
  if (actor.hostel !== c.hostel) {
    throw new ApiError("FORBIDDEN", "You can only support complaints from your own hostel.");
  }
  if (String(c.student.userId) === actor.id) {
    throw new ApiError("CONFLICT", "This is your own complaint.");
  }

  const existing = c.upvotes.some((id) => String(id) === actor.id);
  if (existing) {
    c.upvotes = c.upvotes.filter((id) => String(id) !== actor.id);
  } else {
    c.upvotes.push(actor.id as never);
  }
  c.upvoteCount = c.upvotes.length;
  await refreshDerived(c);
  await c.save();

  if (!existing) {
    await logEvent({
      complaintId: c._id,
      complaintCode: c.code,
      actor: { id: actor.id, name: actor.name, role: actor.role },
      action: "UPVOTED",
      visibility: "PUBLIC",
      request,
    });
  }

  return { upvoted: !existing, count: c.upvoteCount };
}

/* ---------------------------------------------------------------------------
 * Severity override (logged — students see that staff changed their judgement)
 * ------------------------------------------------------------------------ */

export async function changeSeverity(
  c: ComplaintDoc,
  severity: IComplaint["severity"],
  reason: string,
  actor: CurrentUser,
  request?: Request,
): Promise<ComplaintDoc> {
  const settings = await getSettings();
  const previous = c.severity;
  if (previous === severity) return c;

  c.severity = severity;
  c.severityOverriddenBy = actor.id as never;

  // Re-stamp the SLA clocks against the new severity.
  const due = computeSlaDueDates(c.createdAt, severity, settings);
  c.sla.ackDueAt = due.ackDueAt;
  c.sla.resolveDueAt = due.resolveDueAt;

  c.lastActivityAt = new Date();
  await refreshDerived(c);
  await c.save();

  await logEvent({
    complaintId: c._id,
    complaintCode: c.code,
    actor: { id: actor.id, name: actor.name, role: actor.role },
    action: "SEVERITY_CHANGED",
    message: reason,
    meta: { from: previous, to: severity },
    request,
  });

  await notifyInApp(c.student.userId, {
    type: "SEVERITY_CHANGED",
    title: `${c.code} — severity updated`,
    body: `Staff changed the severity from ${previous} to ${severity}. Reason: ${reason}`,
    link: `/student/complaints/${c._id}`,
    tone: "info",
  });

  return c;
}

/* ---------------------------------------------------------------------------
 * Comments
 * ------------------------------------------------------------------------ */

export async function addComment(
  c: ComplaintDoc,
  message: string,
  internal: boolean,
  actor: CurrentUser,
  request?: Request,
): Promise<void> {
  if (internal && actor.role === "STUDENT") {
    throw new ApiError("FORBIDDEN", "Students cannot add internal notes.");
  }

  c.lastActivityAt = new Date();
  await c.save();

  await logEvent({
    complaintId: c._id,
    complaintCode: c.code,
    actor: { id: actor.id, name: actor.name, role: actor.role },
    action: internal ? "INTERNAL_NOTE_ADDED" : "COMMENT_ADDED",
    message,
    visibility: internal ? "INTERNAL" : "PUBLIC",
    request,
  });

  if (!internal) {
    if (actor.role === "STUDENT") {
      const recipients = await resolveStaffRecipients(c.hostel);
      await notifyManyInApp(
        recipients.allStaff.map((u) => u._id),
        {
          type: "COMMENT",
          title: `${c.code} — new comment`,
          body: message.slice(0, 180),
          link: `/staff/complaints/${c._id}`,
        },
      );
    } else {
      await notifyInApp(c.student.userId, {
        type: "COMMENT",
        title: `${c.code} — new reply from staff`,
        body: message.slice(0, 180),
        link: `/student/complaints/${c._id}`,
      });
    }
  }
}

export { Complaint };
