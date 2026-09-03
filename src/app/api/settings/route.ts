import type { NextRequest } from "next/server";
import { requireRole, requireStaff } from "@/lib/auth/session";
import { ok, handleRoute, zodFail } from "@/lib/api/response";
import { settingsUpdateSchema } from "@/lib/validation/schemas";
import { getSettings, updateSettings } from "@/lib/services/settings";
import { SystemLog } from "@/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    await requireStaff();
    const settings = await getSettings();
    return ok({ settings });
  });
}

export async function PATCH(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await requireRole("COORDINATOR");

    const body = await request.json().catch(() => ({}));
    const parsed = settingsUpdateSchema.safeParse(body);
    if (!parsed.success) return zodFail(parsed.error);

    const before = await getSettings();
    const settings = await updateSettings(parsed.data as never, actor.name);

    // Changing an SLA or an escalation window changes what staff are held to,
    // so it belongs in the permanent record.
    await SystemLog.create({
      level: "INFO",
      source: "settings",
      message: `${actor.name} updated system settings.`,
      meta: { before, after: settings, changedKeys: Object.keys(parsed.data) },
    });

    return ok({ settings });
  });
}
