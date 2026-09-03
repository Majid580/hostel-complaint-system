import type { NextRequest } from "next/server";
import { requireStudent } from "@/lib/auth/session";
import { ok, handleRoute, zodFail } from "@/lib/api/response";
import { enforceRateLimit } from "@/lib/api/rateLimit";
import { loadComplaint } from "@/lib/api/loadComplaint";
import { escalateSchema } from "@/lib/validation/schemas";
import { escalateComplaint } from "@/lib/services/complaints";
import { getSettings } from "@/lib/services/settings";
import { serializeComplaint } from "@/lib/services/serialize";

export const runtime = "nodejs";

/**
 * G6 — after 24 hours of inaction the student can escalate straight to the
 * Hostel Warden. Eligibility is enforced inside `escalateComplaint`, so the
 * button being visible is never enough on its own.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { id } = await context.params;
    const actor = await requireStudent();
    await enforceRateLimit("escalate", `${actor.id}:${id}`, "escalate this complaint");

    const body = await request.json().catch(() => ({}));
    const parsed = escalateSchema.safeParse(body);
    if (!parsed.success) return zodFail(parsed.error);

    const complaint = await loadComplaint(id, actor, "reporter");
    await escalateComplaint(complaint, parsed.data.reason, actor, request);

    const settings = await getSettings();
    return ok({
      complaint: serializeComplaint(complaint.toObject() as never, actor, settings),
      message:
        complaint.escalationLevel === 1
          ? "The Hostel Warden has been notified."
          : "The Campus Coordinator has been notified.",
    });
  });
}
