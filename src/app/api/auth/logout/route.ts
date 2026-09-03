import { clearSession } from "@/lib/auth/session";
import { ok, handleRoute } from "@/lib/api/response";

export const runtime = "nodejs";

export async function POST() {
  return handleRoute(async () => {
    await clearSession();
    return ok({ signedOut: true });
  });
}
