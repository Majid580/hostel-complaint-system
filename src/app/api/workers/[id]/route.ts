import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Complaint, Worker } from "@/models";
import { requireStaff } from "@/lib/auth/session";
import { ok, fail, handleRoute, zodFail } from "@/lib/api/response";
import { workerSchema } from "@/lib/validation/schemas";
import { canManageWorkers } from "@/lib/auth/permissions";
import { serializeWorker } from "@/lib/services/workers";
import { OPEN_STATUSES } from "@/lib/domain/constants";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { id } = await context.params;
    const actor = await requireStaff();

    const body = await request.json().catch(() => ({}));
    const parsed = workerSchema.partial().safeParse(body);
    if (!parsed.success) return zodFail(parsed.error);

    await connectDB();
    const worker = await Worker.findById(id);
    if (!worker) return fail("NOT_FOUND", "Worker not found.");

    // The RT must be allowed to manage the worker both before and after the edit.
    const affected = [...worker.hostels, ...(parsed.data.hostels ?? [])];
    for (const hostel of affected) {
      if (!canManageWorkers(actor, hostel)) {
        return fail("FORBIDDEN", "You can only manage workers for your own hostel.");
      }
    }

    Object.assign(worker, parsed.data);
    await worker.save();

    return ok({ worker: serializeWorker(worker.toObject() as never) });
  });
}

/** Workers are deactivated, never deleted — their history stays auditable. */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { id } = await context.params;
    const actor = await requireStaff();

    await connectDB();
    const worker = await Worker.findById(id);
    if (!worker) return fail("NOT_FOUND", "Worker not found.");

    for (const hostel of worker.hostels) {
      if (!canManageWorkers(actor, hostel)) {
        return fail("FORBIDDEN", "You can only manage workers for your own hostel.");
      }
    }

    const openJobs = await Complaint.countDocuments({
      "assignment.workerId": worker._id,
      status: { $in: [...OPEN_STATUSES] },
    } as never);

    if (openJobs > 0) {
      return fail(
        "CONFLICT",
        `${worker.name} still has ${openJobs} open job(s). Reassign them before deactivating this worker.`,
      );
    }

    worker.isActive = false;
    await worker.save();

    return ok({ deactivated: true });
  });
}
