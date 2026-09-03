import type { NextRequest } from "next/server";
import { requireStudent } from "@/lib/auth/session";
import { ok, handleRoute, zodFail } from "@/lib/api/response";
import { enforceRateLimit } from "@/lib/api/rateLimit";
import { loadComplaint } from "@/lib/api/loadComplaint";
import { flagFalseResolutionSchema } from "@/lib/validation/schemas";
import { flagFalseResolution } from "@/lib/services/complaints";
import { getSettings } from "@/lib/services/settings";
import { serializeComplaint } from "@/lib/services/serialize";

export const runtime = "nodejs";

/**
 * G7 — the accountability path. If staff marked a complaint resolved but the
 * work was never done, the student can report that 24 hours later. The
 * complaint reopens, is flagged disputed, and the Warden and Coordinator are
 * e-mailed with the name of whoever marked it resolved.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { id } = await context.params;
    const actor = await requireStudent();
    await enforceRateLimit("escalate", `${actor.id}:${id}:flag`, "report this complaint");

    const body = await request.json().catch(() => ({}));
    const parsed = flagFalseResolutionSchema.safeParse(body);
    if (!parsed.success) return zodFail(parsed.error);

    const complaint = await loadComplaint(id, actor, "reporter");
    await flagFalseResolution(complaint, parsed.data.reason, actor, request);

    const settings = await getSettings();
    return ok({
      complaint: serializeComplaint(complaint.toObject() as never, actor, settings),
      message:
        "Reported. The complaint has been reopened and the Hostel Warden has been notified.",
    });
  });
}
