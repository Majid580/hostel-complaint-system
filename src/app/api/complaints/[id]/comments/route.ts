import type { NextRequest } from "next/server";
import { ComplaintEvent } from "@/models";
import { requireAuth } from "@/lib/auth/session";
import { created, handleRoute, zodFail } from "@/lib/api/response";
import { enforceRateLimit } from "@/lib/api/rateLimit";
import { loadComplaint } from "@/lib/api/loadComplaint";
import { commentSchema } from "@/lib/validation/schemas";
import { addComment } from "@/lib/services/complaints";
import { serializeTimeline } from "@/lib/services/serialize";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { id } = await context.params;
    const actor = await requireAuth();
    await enforceRateLimit("comment", actor.id, "post another comment");

    const body = await request.json().catch(() => ({}));
    const parsed = commentSchema.safeParse(body);
    if (!parsed.success) return zodFail(parsed.error);

    const complaint = await loadComplaint(id, actor, "any");
    await addComment(complaint, parsed.data.message, parsed.data.internal, actor, request);

    const events = await ComplaintEvent.find({ complaintId: id }).sort({ createdAt: 1 }).lean();

    return created({ timeline: serializeTimeline(events as never, actor) });
  });
}
