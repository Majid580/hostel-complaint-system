import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { ok, handleRoute, zodFail } from "@/lib/api/response";
import { enforceRateLimit } from "@/lib/api/rateLimit";
import { uploadSignSchema } from "@/lib/validation/schemas";
import { createSignedUpload } from "@/lib/storage/cloudinary";
import { getSettings } from "@/lib/services/settings";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await requireAuth();
    await enforceRateLimit("upload", actor.id, "upload more files");

    const body = await request.json().catch(() => ({}));
    const parsed = uploadSignSchema.safeParse(body);
    if (!parsed.success) return zodFail(parsed.error);

    // Only staff may upload into the "proofs" folder.
    const folder =
      parsed.data.folder === "proofs" && actor.role === "STUDENT" ? "complaints" : parsed.data.folder;

    const settings = await getSettings();

    const signed = createSignedUpload({
      kind: parsed.data.kind,
      userId: actor.id,
      folder,
      maxImageMb: settings.attachments.maxImageMb,
      maxAudioMb: settings.attachments.maxAudioMb,
    });

    return ok(signed);
  });
}
