import type { NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth/session";
import { ok, handleRoute, zodFail } from "@/lib/api/response";
import { loadComplaint } from "@/lib/api/loadComplaint";
import { severityChangeSchema } from "@/lib/validation/schemas";
import { changeSeverity } from "@/lib/services/complaints";
import { getSettings } from "@/lib/services/settings";
import { serializeComplaint } from "@/lib/services/serialize";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { id } = await context.params;
    const actor = await requireStaff();

    const body = await request.json().catch(() => ({}));
    const parsed = severityChangeSchema.safeParse(body);
    if (!parsed.success) return zodFail(parsed.error);

    const complaint = await loadComplaint(id, actor, "staff");
    await changeSeverity(complaint, parsed.data.severity, parsed.data.reason, actor, request);

    const settings = await getSettings();
    return ok({
      complaint: serializeComplaint(complaint.toObject() as never, actor, settings, {
        includeActions: true,
      }),
    });
  });
}
