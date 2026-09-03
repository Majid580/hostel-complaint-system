import type { NextRequest } from "next/server";
import { requireStudent } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Complaint } from "@/models";
import { ok, fail, handleRoute } from "@/lib/api/response";
import { toggleUpvote } from "@/lib/services/complaints";
import { canViewComplaint } from "@/lib/auth/permissions";

export const runtime = "nodejs";

/**
 * "Me too". A student can support a complaint from their own hostel even though
 * they cannot open it — support raises its priority, which is the point.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { id } = await context.params;
    const actor = await requireStudent();

    if (!/^[a-f\d]{24}$/i.test(id)) return fail("NOT_FOUND", "Complaint not found.");

    await connectDB();
    const complaint = await Complaint.findOne({ _id: id, deletedAt: null });
    if (!complaint) return fail("NOT_FOUND", "Complaint not found.");

    const isOwn = canViewComplaint(actor, {
      hostel: complaint.hostel,
      studentUserId: String(complaint.student.userId),
    });
    if (!isOwn && complaint.hostel !== actor.hostel) {
      return fail("FORBIDDEN", "You can only support complaints from your own hostel.");
    }

    const result = await toggleUpvote(complaint, actor, request);
    return ok(result);
  });
}
