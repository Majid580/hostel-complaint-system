import { getCurrentUser } from "@/lib/auth/session";
import { ok, handleRoute } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    const user = await getCurrentUser();
    return ok({ user });
  });
}
