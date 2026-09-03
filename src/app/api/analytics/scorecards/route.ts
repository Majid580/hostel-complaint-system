import { requireStaff } from "@/lib/auth/session";
import { ok, handleRoute } from "@/lib/api/response";
import { getStaffScorecards } from "@/lib/services/analytics";
import { listWorkers } from "@/lib/services/workers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    const actor = await requireStaff();
    const [staff, workers] = await Promise.all([
      getStaffScorecards(actor),
      listWorkers(actor),
    ]);
    return ok({ staff, workers });
  });
}
