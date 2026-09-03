import { connectDB } from "@/lib/db/mongoose";
import { Worker, type IWorker } from "@/models";
import { visibleHostels } from "@/lib/auth/permissions";
import type { CurrentUser } from "@/lib/auth/session";
import { TRADE_LABEL, type Hostel } from "@/lib/domain/constants";

/**
 * Worker records plus the derived performance numbers that make assignment
 * accountable: how many jobs were completed on time, and how often the student
 * had to reopen the complaint afterwards.
 */
export function serializeWorker(w: IWorker & { _id: unknown }) {
  const stats = w.stats ?? {
    assigned: 0,
    completed: 0,
    onTime: 0,
    reopened: 0,
    totalTatHours: 0,
  };

  const completionRate = stats.assigned ? stats.completed / stats.assigned : 0;
  const onTimeRate = stats.completed ? stats.onTime / stats.completed : 0;
  const reopenRate = stats.completed ? stats.reopened / stats.completed : 0;
  const avgTatHours = stats.completed ? stats.totalTatHours / stats.completed : 0;

  return {
    id: String(w._id),
    name: w.name,
    phone: w.phone ?? null,
    trade: w.trade,
    tradeLabel: TRADE_LABEL[w.trade],
    hostels: w.hostels,
    isActive: w.isActive,
    notes: w.notes ?? null,
    stats: {
      assigned: stats.assigned,
      completed: stats.completed,
      open: Math.max(0, stats.assigned - stats.completed),
      onTime: stats.onTime,
      reopened: stats.reopened,
      completionRate: Math.round(completionRate * 100),
      onTimeRate: Math.round(onTimeRate * 100),
      reopenRate: Math.round(reopenRate * 100),
      avgTatHours: Math.round(avgTatHours * 10) / 10,
    },
    createdAt: w.createdAt,
  };
}

export type SerializedWorker = ReturnType<typeof serializeWorker>;

export async function listWorkers(
  actor: CurrentUser,
  options: { hostel?: Hostel; activeOnly?: boolean } = {},
): Promise<SerializedWorker[]> {
  await connectDB();

  const query: Record<string, unknown> = {};
  const allowed = visibleHostels(actor);

  if (options.hostel) {
    query.hostels = options.hostel;
  } else if (allowed) {
    query.hostels = { $in: allowed };
  }
  if (options.activeOnly) query.isActive = true;

  const workers = await Worker.find(query as never)
    .sort({ isActive: -1, name: 1 })
    .lean();

  return workers.map((w) => serializeWorker(w as never));
}
