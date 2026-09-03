import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Worker } from "@/models";
import { requireStaff } from "@/lib/auth/session";
import { created, ok, fail, handleRoute, zodFail } from "@/lib/api/response";
import { workerSchema } from "@/lib/validation/schemas";
import { canManageWorkers, visibleHostels } from "@/lib/auth/permissions";
import { serializeWorker } from "@/lib/services/workers";
import type { Hostel } from "@/lib/domain/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await requireStaff();
    await connectDB();

    const query: Record<string, unknown> = {};
    const allowed = visibleHostels(actor);
    if (allowed) query.hostels = { $in: allowed };

    const hostel = request.nextUrl.searchParams.get("hostel") as Hostel | null;
    if (hostel) query.hostels = allowed && !allowed.includes(hostel) ? { $in: [] } : hostel;

    const trade = request.nextUrl.searchParams.get("trade");
    if (trade) query.trade = trade;

    if (request.nextUrl.searchParams.get("activeOnly") === "true") query.isActive = true;

    const workers = await Worker.find(query as never)
      .sort({ isActive: -1, name: 1 })
      .lean();

    return ok({ workers: workers.map((w) => serializeWorker(w as never)) });
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await requireStaff();

    const body = await request.json().catch(() => ({}));
    const parsed = workerSchema.safeParse(body);
    if (!parsed.success) return zodFail(parsed.error);

    // An RT may only register workers for their own hostel.
    for (const hostel of parsed.data.hostels) {
      if (!canManageWorkers(actor, hostel)) {
        return fail("FORBIDDEN", "You can only add workers for your own hostel.", {
          hostels: "Outside your hostel.",
        });
      }
    }

    await connectDB();
    const worker = await Worker.create({
      ...parsed.data,
      notes: parsed.data.notes || undefined,
      phone: parsed.data.phone || undefined,
      createdBy: actor.id,
    });

    return created({ worker: serializeWorker(worker.toObject() as never) });
  });
}
