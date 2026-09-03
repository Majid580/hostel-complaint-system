import type { NextRequest } from "next/server";
import { requireStudent } from "@/lib/auth/session";
import { ok, handleRoute, zodFail } from "@/lib/api/response";
import { loadComplaint } from "@/lib/api/loadComplaint";
import { verifyComplaintSchema } from "@/lib/validation/schemas";
import { verifyResolution } from "@/lib/services/complaints";
import { getSettings } from "@/lib/services/settings";
import { serializeComplaint } from "@/lib/services/serialize";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { id } = await context.params;
    const actor = await requireStudent();

    const body = await request.json().catch(() => ({}));
    const parsed = verifyComplaintSchema.safeParse(body);
    if (!parsed.success) return zodFail(parsed.error);

    const complaint = await loadComplaint(id, actor, "reporter");
    await verifyResolution(complaint, parsed.data, actor, request);

    const settings = await getSettings();
    return ok({
      complaint: serializeComplaint(complaint.toObject() as never, actor, settings),
      message: "Thank you — this complaint is now closed.",
    });
  });
}
