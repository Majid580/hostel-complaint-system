import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Complaint } from "@/models";
import { requireAuth, requireStudent } from "@/lib/auth/session";
import { created, ok, fail, handleRoute, zodFail } from "@/lib/api/response";
import { enforceRateLimit } from "@/lib/api/rateLimit";
import { complaintFilterSchema, createComplaintSchema } from "@/lib/validation/schemas";
import { getSettings } from "@/lib/services/settings";
import { nextComplaintCode } from "@/lib/services/complaintCode";
import { logEvent } from "@/lib/services/events";
import { queueMail, notifyManyInApp, resolveStaffRecipients } from "@/lib/services/notify";
import { complaintReceipt, newComplaintForStaff } from "@/lib/mail/templates";
import { listComplaints } from "@/lib/services/listComplaints";
import { computeSlaDueDates } from "@/lib/domain/sla";
import { computePriorityScore } from "@/lib/domain/priority";
import { verifyUploadedAsset } from "@/lib/storage/cloudinary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ==========================================================================
 * POST /api/complaints — a student files a complaint
 * ======================================================================= */

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await requireStudent();
    const settings = await getSettings();

    await enforceRateLimit("createComplaint", actor.id, "file another complaint");

    const body = await request.json().catch(() => ({}));
    const parsed = createComplaintSchema.safeParse(body);
    if (!parsed.success) return zodFail(parsed.error);
    const data = parsed.data;

    // A student may only file against the hostel they are registered in.
    if (actor.hostel && data.hostel !== actor.hostel) {
      return fail("FORBIDDEN", "You can only file complaints for the hostel you live in.", {
        hostel: "This is not the hostel on your account. Ask your RT if you have moved.",
      });
    }

    if (data.isAnonymous && !settings.policy.allowAnonymous) {
      return fail("FORBIDDEN", "Anonymous complaints are currently disabled.");
    }
    if (data.images.length > settings.attachments.maxImages) {
      return fail(
        "PAYLOAD_TOO_LARGE",
        `You can attach at most ${settings.attachments.maxImages} photos.`,
      );
    }
    if (
      data.audio?.duration &&
      data.audio.duration > settings.attachments.maxAudioSeconds + 5
    ) {
      return fail(
        "PAYLOAD_TOO_LARGE",
        `Voice notes must be under ${settings.attachments.maxAudioSeconds} seconds.`,
      );
    }

    // Attachments are uploaded straight to the media host, so verify here that
    // the claimed assets really are ours and really belong to this student.
    for (const image of data.images) {
      const check = await verifyUploadedAsset(image.publicId, "image", actor.id);
      if (!check.ok) return fail("FORBIDDEN", check.reason ?? "Invalid attachment.");
    }
    if (data.audio) {
      const check = await verifyUploadedAsset(data.audio.publicId, "audio", actor.id);
      if (!check.ok) return fail("FORBIDDEN", check.reason ?? "Invalid attachment.");
    }

    await connectDB();

    const now = new Date();
    const code = await nextComplaintCode(now);
    const sla = computeSlaDueDates(now, data.severity, settings);

    const complaint = await Complaint.create({
      code,
      student: {
        userId: actor.id,
        regNo: actor.regNo,
        name: actor.name,
        email: actor.email,
        roomNo: data.roomNo || undefined,
      },
      hostel: data.hostel,
      category: data.category,
      title: data.title,
      description: data.description,
      location: data.location || undefined,
      images: data.images,
      audio: data.audio ?? null,
      severity: data.severity,
      status: "SUBMITTED",
      priorityScore: computePriorityScore(
        { severity: data.severity, category: data.category, status: "SUBMITTED", createdAt: now },
        settings.priorityWeights,
        now,
      ),
      escalationLevel: 0,
      isDisputed: false,
      sla: {
        ackDueAt: sla.ackDueAt,
        resolveDueAt: sla.resolveDueAt,
        ackBreached: false,
        resolveBreached: false,
        firstResponseAt: null,
      },
      isAnonymous: data.isAnonymous,
      lastActivityAt: now,
      createdAt: now,
    });

    await logEvent({
      complaintId: complaint._id,
      complaintCode: code,
      actor: { id: actor.id, name: actor.name, role: "STUDENT" },
      action: "CREATED",
      toStatus: "SUBMITTED",
      message: data.description,
      meta: {
        images: data.images.length,
        hasAudio: Boolean(data.audio),
        severity: data.severity,
      },
      request,
    });

    /* --- G2: route it to the RT of that hostel AND the Warden ------------- */
    const summary = {
      code,
      title: data.title,
      description: data.description,
      hostel: data.hostel,
      category: data.category,
      severity: data.severity,
      status: "SUBMITTED" as const,
      studentName: data.isAnonymous ? `${actor.name} (filed anonymously)` : actor.name,
      regNo: actor.regNo ?? "",
      roomNo: data.roomNo || undefined,
      location: data.location || undefined,
      createdAt: now,
      imageCount: data.images.length,
      hasAudio: Boolean(data.audio),
    };

    const recipients = await resolveStaffRecipients(data.hostel);

    await queueMail(recipients.primaryEmails, newComplaintForStaff(summary, String(complaint._id)), {
      relatedComplaint: complaint._id,
    });
    await queueMail([actor.email], complaintReceipt(summary, String(complaint._id)), {
      relatedComplaint: complaint._id,
    });

    await notifyManyInApp(
      recipients.allStaff.map((u) => u._id),
      {
        type: "NEW_COMPLAINT",
        title: `New complaint — ${code}`,
        body: `${data.title} (${data.severity})`,
        link: `/staff/complaints/${complaint._id}`,
        tone: data.severity === "CRITICAL" ? "danger" : "info",
      },
    );

    return created({
      id: String(complaint._id),
      code,
      status: complaint.status,
      redirectTo: `/student/complaints/${complaint._id}`,
    });
  });
}

/* ==========================================================================
 * GET /api/complaints — role-scoped, filtered, sorted, paginated
 * ======================================================================= */

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await requireAuth();

    const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = complaintFilterSchema.safeParse(raw);
    if (!parsed.success) return zodFail(parsed.error);

    const result = await listComplaints(actor, parsed.data);
    return ok(result);
  });
}
