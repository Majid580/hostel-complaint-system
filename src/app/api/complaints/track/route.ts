import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Complaint, ComplaintEvent } from "@/models";
import { ok, fail, handleRoute, zodFail } from "@/lib/api/response";
import { clientIp, enforceRateLimit } from "@/lib/api/rateLimit";
import { trackSchema } from "@/lib/validation/schemas";
import { normalizeComplaintCode } from "@/lib/services/complaintCode";
import { describeEvent } from "@/lib/services/events";
import { STATUS_META, TRADE_LABEL } from "@/lib/domain/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public status lookup. Needs BOTH the ticket number and the reporter's
 * registration number, so a ticket number on its own leaks nothing. Returns a
 * deliberately thin view: status and progress, never the description, photos,
 * voice note, contact details or internal notes.
 */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    await enforceRateLimit("login", `track:${clientIp(request)}`, "look up another complaint");

    const body = await request.json().catch(() => ({}));
    const parsed = trackSchema.safeParse(body);
    if (!parsed.success) return zodFail(parsed.error);

    const code = normalizeComplaintCode(parsed.data.code);
    if (!code) {
      return fail("VALIDATION_ERROR", "That does not look like a ticket number.", {
        code: "Example: HCMS-2026-000123",
      });
    }

    await connectDB();
    const complaint = await Complaint.findOne({
      code,
      "student.regNo": parsed.data.regNo,
      deletedAt: null,
    }).lean();

    if (!complaint) {
      return fail(
        "NOT_FOUND",
        "No complaint matches that ticket number and registration number.",
      );
    }

    const events = await ComplaintEvent.find({
      complaintId: complaint._id,
      visibility: "PUBLIC",
    })
      .sort({ createdAt: 1 })
      .select("action actorName actorRole fromStatus toStatus createdAt meta")
      .lean();

    return ok({
      complaint: {
        code: complaint.code,
        title: complaint.title,
        hostel: complaint.hostel,
        category: complaint.category,
        severity: complaint.severity,
        status: complaint.status,
        statusLabel: STATUS_META[complaint.status].label,
        statusDescription: STATUS_META[complaint.status].description,
        escalationLevel: complaint.escalationLevel,
        isDisputed: complaint.isDisputed,
        assignedWorker: complaint.assignment
          ? {
              name: complaint.assignment.workerName,
              trade: TRADE_LABEL[complaint.assignment.trade],
              expectedCompletionAt: complaint.assignment.expectedCompletionAt ?? null,
            }
          : null,
        resolvedAt: complaint.resolution?.resolvedAt ?? null,
        createdAt: complaint.createdAt,
        resolveDueAt: complaint.sla.resolveDueAt,
        resolveBreached: complaint.sla.resolveBreached,
      },
      timeline: events.map((e) => ({
        summary: describeEvent(e as never),
        createdAt: e.createdAt,
        toStatus: e.toStatus ?? null,
      })),
    });
  });
}
