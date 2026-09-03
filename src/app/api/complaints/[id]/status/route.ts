import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { ok, handleRoute, zodFail } from "@/lib/api/response";
import { loadComplaint } from "@/lib/api/loadComplaint";
import { statusChangeSchema } from "@/lib/validation/schemas";
import { transitionStatus } from "@/lib/services/complaints";
import { getSettings } from "@/lib/services/settings";
import { serializeComplaint } from "@/lib/services/serialize";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { id } = await context.params;
    const actor = await requireAuth();

    const body = await request.json().catch(() => ({}));
    const parsed = statusChangeSchema.safeParse(body);
    if (!parsed.success) return zodFail(parsed.error);

    // Students may only reach RESOLVED -> VERIFIED_CLOSED / REOPENED, which the
    // state machine enforces; everything else needs staff rights.
    const access = actor.role === "STUDENT" ? "reporter" : "staff";
    const complaint = await loadComplaint(id, actor, access);

    await transitionStatus(
      complaint,
      parsed.data.to,
      actor,
      {
        note: parsed.data.note,
        reason: parsed.data.reason,
        holdUntil: parsed.data.holdUntil || undefined,
        proofImages: parsed.data.proofImages,
        workerId: parsed.data.workerId,
        expectedCompletionAt: parsed.data.expectedCompletionAt || undefined,
      },
      request,
    );

    const settings = await getSettings();
    return ok({
      complaint: serializeComplaint(complaint.toObject() as never, actor, settings, {
        includeActions: true,
      }),
    });
  });
}
