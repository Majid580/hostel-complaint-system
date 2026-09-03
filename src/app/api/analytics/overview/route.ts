import type { NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth/session";
import { ok, handleRoute } from "@/lib/api/response";
import { getOverview } from "@/lib/services/analytics";
import { HOSTELS, type Hostel } from "@/lib/domain/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await requireStaff();
    const hostelParam = request.nextUrl.searchParams.get("hostel");
    const hostel = HOSTELS.includes(hostelParam as Hostel) ? (hostelParam as Hostel) : undefined;
    const days = Math.min(Number(request.nextUrl.searchParams.get("days") ?? 30) || 30, 365);

    const overview = await getOverview(actor, { hostel, days });
    return ok(overview);
  });
}
