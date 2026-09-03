import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Complaint, ComplaintEvent } from "@/models";
import { requireAuth } from "@/lib/auth/session";
import { ok, fail, handleRoute } from "@/lib/api/response";
import { getSettings } from "@/lib/services/settings";
import { serializeComplaint, serializeTimeline } from "@/lib/services/serialize";
import { canViewComplaint } from "@/lib/auth/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { id } = await context.params;
    const actor = await requireAuth();

    if (!/^[a-f\d]{24}$/i.test(id)) return fail("NOT_FOUND", "Complaint not found.");

    await connectDB();
    const complaint = await Complaint.findOne({ _id: id, deletedAt: null }).lean();
    if (!complaint) return fail("NOT_FOUND", "Complaint not found.");

    const scope = {
      hostel: complaint.hostel,
      studentUserId: String(complaint.student.userId),
    };
    // A 404 rather than a 403: staff from another hostel should not learn it exists.
    if (!canViewComplaint(actor, scope)) return fail("NOT_FOUND", "Complaint not found.");

    const [events, settings] = await Promise.all([
      ComplaintEvent.find({ complaintId: id }).sort({ createdAt: 1 }).lean(),
      getSettings(),
    ]);

    return ok({
      complaint: serializeComplaint(complaint as never, actor, settings, { includeActions: true }),
      timeline: serializeTimeline(events as never, actor),
    });
  });
}
