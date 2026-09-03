import { connectDB } from "@/lib/db/mongoose";
import { Complaint } from "@/models";
import { ApiError } from "@/lib/api/response";
import { visibleHostels } from "@/lib/auth/permissions";
import type { CurrentUser } from "@/lib/auth/session";
import { serializeComplaintRow } from "./serialize";
import {
  ACTIONABLE_STATUSES,
  CLOSED_STATUSES,
  OPEN_STATUSES,
} from "@/lib/domain/constants";
import type { ComplaintFilterInput } from "@/lib/validation/schemas";

export type ComplaintRow = ReturnType<typeof serializeComplaintRow>;

export type ComplaintListResult = {
  complaints: ComplaintRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
  };
};

/**
 * The one query that backs both `GET /api/complaints` and the server-rendered
 * queue pages, so the hostel-scoping rule cannot drift between them.
 */
export async function listComplaints(
  actor: CurrentUser,
  f: ComplaintFilterInput,
  /**
   * Set `withTotal: false` for a fixed-size panel that never renders a total or
   * a pager — the dashboard's three lists, for example. It saves a whole
   * countDocuments round trip each, which on a free-tier cluster is ~130 ms of
   * pure waste. `pagination.total` then reports only what was fetched.
   */
  options: { withTotal?: boolean } = {},
): Promise<ComplaintListResult> {
  await connectDB();

  const query: Record<string, unknown> = { deletedAt: null };

  /* --- Scope: the wall between hostels --------------------------------- */
  if (actor.role === "STUDENT") {
    query["student.userId"] = actor.id;
  } else {
    const allowed = visibleHostels(actor);
    if (allowed) {
      if (f.hostel && !allowed.includes(f.hostel)) {
        throw new ApiError("FORBIDDEN", "You can only view complaints from your own hostel.");
      }
      query.hostel = f.hostel ?? { $in: allowed };
    } else if (f.hostel) {
      query.hostel = f.hostel;
    }
  }

  /* --- Filters ---------------------------------------------------------- */
  if (f.view === "open") query.status = { $in: [...OPEN_STATUSES] };
  else if (f.view === "closed") query.status = { $in: [...CLOSED_STATUSES] };
  else if (f.view === "actionRequired") query.status = { $in: [...ACTIONABLE_STATUSES] };

  if (f.status) query.status = Array.isArray(f.status) ? { $in: f.status } : f.status;
  if (f.category) query.category = f.category;
  if (f.severity) query.severity = f.severity;
  if (f.escalated) query.escalationLevel = { $gte: 1 };
  if (f.disputed) query.isDisputed = true;
  if (f.slaBreached) query["sla.resolveBreached"] = true;
  if (f.assignedTo) query["assignment.workerId"] = f.assignedTo;

  if (f.from || f.to) {
    const range: Record<string, Date> = {};
    if (f.from) range.$gte = new Date(f.from);
    if (f.to) range.$lte = new Date(f.to);
    query.createdAt = range;
  }

  if (f.q) {
    const escaped = f.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(escaped, "i");
    query.$or = [
      { code: rx },
      { title: rx },
      { description: rx },
      { location: rx },
      { "student.regNo": rx },
      ...(actor.role === "STUDENT" ? [] : [{ "student.name": rx }]),
    ];
  }

  /* --- Sorting ---------------------------------------------------------- */
  const sortMap: Record<string, Record<string, 1 | -1>> = {
    priority: { priorityScore: -1, createdAt: 1 },
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    dueSoon: { "sla.resolveDueAt": 1 },
    severity: { severity: -1, priorityScore: -1 },
  };
  const sort = sortMap[f.sort] ?? sortMap.priority;

  const skip = (f.page - 1) * f.limit;

  const withTotal = options.withTotal !== false;

  const [rows, counted] = await Promise.all([
    Complaint.find(query as never)
      .sort(sort)
      .skip(skip)
      .limit(f.limit)
      .lean(),
    withTotal ? Complaint.countDocuments(query as never) : Promise.resolve(null),
  ]);

  const total = counted ?? skip + rows.length;

  return {
    complaints: rows.map((c) => serializeComplaintRow(c as never, actor)),
    pagination: {
      page: f.page,
      limit: f.limit,
      total,
      pages: withTotal ? Math.max(1, Math.ceil(total / f.limit)) : 1,
      hasNext: withTotal ? skip + rows.length < total : rows.length === f.limit,
    },
  };
}

/** Counts used by the dashboard tiles, scoped the same way. */
export async function complaintCounts(actor: CurrentUser) {
  await connectDB();

  const base: Record<string, unknown> = { deletedAt: null };
  if (actor.role === "STUDENT") {
    base["student.userId"] = actor.id;
  } else {
    const allowed = visibleHostels(actor);
    if (allowed) base.hostel = { $in: allowed };
  }

  const [total, open, actionRequired, resolved, closed, escalated, disputed, breached, awaitingMe] =
    await Promise.all([
      Complaint.countDocuments(base as never),
      Complaint.countDocuments({ ...base, status: { $in: [...OPEN_STATUSES] } } as never),
      Complaint.countDocuments({ ...base, status: { $in: [...ACTIONABLE_STATUSES] } } as never),
      Complaint.countDocuments({ ...base, status: "RESOLVED" } as never),
      Complaint.countDocuments({ ...base, status: { $in: [...CLOSED_STATUSES] } } as never),
      Complaint.countDocuments({
        ...base,
        escalationLevel: { $gte: 1 },
        status: { $in: [...OPEN_STATUSES] },
      } as never),
      Complaint.countDocuments({
        ...base,
        isDisputed: true,
        status: { $in: [...OPEN_STATUSES] },
      } as never),
      Complaint.countDocuments({
        ...base,
        "sla.resolveBreached": true,
        status: { $in: [...OPEN_STATUSES] },
      } as never),
      Complaint.countDocuments({ ...base, status: "RESOLVED" } as never),
    ]);

  return { total, open, actionRequired, resolved, closed, escalated, disputed, breached, awaitingMe };
}
