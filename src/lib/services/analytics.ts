import { connectDB } from "@/lib/db/mongoose";
import { Complaint, User } from "@/models";
import { visibleHostels } from "@/lib/auth/permissions";
import type { CurrentUser } from "@/lib/auth/session";
import {
  CATEGORIES,
  CATEGORY_META,
  HOSTELS,
  HOSTEL_META,
  OPEN_STATUSES,
  SEVERITIES,
  STATUSES,
  STATUS_META,
  type Category,
  type ComplaintStatus,
  type Hostel,
  type Severity,
} from "@/lib/domain/constants";
import { AGE_BUCKETS, type AgeBucketKey } from "@/lib/domain/sla";

const HOUR = 3_600_000;

function scopeFilter(actor: CurrentUser, hostel?: Hostel): Record<string, unknown> {
  const base: Record<string, unknown> = { deletedAt: null };
  const allowed = visibleHostels(actor);

  if (hostel) {
    base.hostel = allowed && !allowed.includes(hostel) ? "__none__" : hostel;
  } else if (allowed) {
    base.hostel = { $in: allowed };
  }
  return base;
}

export type Overview = Awaited<ReturnType<typeof getOverview>>;

export async function getOverview(
  actor: CurrentUser,
  options: { hostel?: Hostel; days?: number } = {},
) {
  await connectDB();

  const days = options.days ?? 30;
  const since = new Date(Date.now() - days * 24 * HOUR);
  const match = scopeFilter(actor, options.hostel);

  const [
    byStatus,
    bySeverity,
    byCategory,
    byHostel,
    resolutionStats,
    slaStats,
    openList,
    trendRaw,
    ratingStats,
  ] = await Promise.all([
    Complaint.aggregate([{ $match: match }, { $group: { _id: "$status", count: { $sum: 1 } } }]),

    Complaint.aggregate([
      { $match: { ...match, status: { $in: [...OPEN_STATUSES] } } },
      { $group: { _id: "$severity", count: { $sum: 1 } } },
    ]),

    Complaint.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$category",
          total: { $sum: 1 },
          open: {
            $sum: { $cond: [{ $in: ["$status", [...OPEN_STATUSES]] }, 1, 0] },
          },
        },
      },
      { $sort: { total: -1 } },
    ]),

    Complaint.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$hostel",
          total: { $sum: 1 },
          open: { $sum: { $cond: [{ $in: ["$status", [...OPEN_STATUSES]] }, 1, 0] } },
          breached: { $sum: { $cond: ["$sla.resolveBreached", 1, 0] } },
          escalated: { $sum: { $cond: [{ $gte: ["$escalationLevel", 1] }, 1, 0] } },
          disputed: { $sum: { $cond: ["$isDisputed", 1, 0] } },
        },
      },
    ]),

    // Average time from filing to resolution, and to first response.
    Complaint.aggregate([
      { $match: { ...match, "resolution.resolvedAt": { $ne: null } } },
      {
        $project: {
          resolveHours: {
            $divide: [{ $subtract: ["$resolution.resolvedAt", "$createdAt"] }, HOUR],
          },
          responseHours: {
            $cond: [
              { $ne: ["$sla.firstResponseAt", null] },
              { $divide: [{ $subtract: ["$sla.firstResponseAt", "$createdAt"] }, HOUR] },
              null,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgResolveHours: { $avg: "$resolveHours" },
          medianSample: { $push: "$resolveHours" },
          avgResponseHours: { $avg: "$responseHours" },
          count: { $sum: 1 },
        },
      },
    ]),

    Complaint.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          ackBreached: { $sum: { $cond: ["$sla.ackBreached", 1, 0] } },
          resolveBreached: { $sum: { $cond: ["$sla.resolveBreached", 1, 0] } },
          reopened: { $sum: { $cond: [{ $gt: ["$reopenCount", 0] }, 1, 0] } },
          disputed: { $sum: { $cond: ["$isDisputed", 1, 0] } },
          escalated: { $sum: { $cond: [{ $gte: ["$escalationLevel", 1] }, 1, 0] } },
        },
      },
    ]),

    Complaint.find({ ...match, status: { $in: [...OPEN_STATUSES] } })
      .select("createdAt")
      .lean(),

    Complaint.aggregate([
      { $match: { ...match, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          filed: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    Complaint.aggregate([
      { $match: { ...match, "verification.rating": { $ne: null } } },
      { $group: { _id: null, avg: { $avg: "$verification.rating" }, count: { $sum: 1 } } },
    ]),
  ]);

  /* --- Shape the results ------------------------------------------------ */

  const statusCounts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<
    ComplaintStatus,
    number
  >;
  for (const row of byStatus) statusCounts[row._id as ComplaintStatus] = row.count;

  const severityCounts = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<
    Severity,
    number
  >;
  for (const row of bySeverity) severityCounts[row._id as Severity] = row.count;

  const total = Object.values(statusCounts).reduce((sum, n) => sum + n, 0);
  const open = OPEN_STATUSES.reduce((sum, s) => sum + statusCounts[s], 0);
  const closed = total - open;

  // Ageing buckets for what is still open.
  const buckets = Object.fromEntries(AGE_BUCKETS.map((b) => [b.key, 0])) as Record<
    AgeBucketKey,
    number
  >;
  const now = Date.now();
  for (const c of openList) {
    const hours = (now - new Date(c.createdAt).getTime()) / HOUR;
    const bucket = AGE_BUCKETS.find((b) => hours < b.maxHours) ?? AGE_BUCKETS[AGE_BUCKETS.length - 1];
    buckets[bucket.key]++;
  }

  const sla = slaStats[0] ?? {
    total: 0,
    ackBreached: 0,
    resolveBreached: 0,
    reopened: 0,
    disputed: 0,
    escalated: 0,
  };
  const resolution = resolutionStats[0];

  const sample: number[] = (resolution?.medianSample ?? []).slice().sort((a: number, b: number) => a - b);
  const median = sample.length ? sample[Math.floor(sample.length / 2)] : 0;

  // Fill missing days so the trend chart has no gaps.
  const trendMap = new Map<string, number>(trendRaw.map((r) => [r._id as string, r.filed as number]));
  const trend: { date: string; filed: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now - i * 24 * HOUR).toISOString().slice(0, 10);
    trend.push({ date: day, filed: trendMap.get(day) ?? 0 });
  }

  return {
    totals: {
      total,
      open,
      closed,
      resolved: statusCounts.RESOLVED,
      escalated: sla.escalated,
      disputed: sla.disputed,
      breached: sla.resolveBreached,
      reopened: sla.reopened,
    },
    statusCounts,
    severityCounts,
    categories: byCategory.map((row) => ({
      category: row._id as Category,
      label: CATEGORY_META[row._id as Category]?.label ?? row._id,
      total: row.total as number,
      open: row.open as number,
    })),
    hostels: HOSTELS.map((h) => {
      const row = byHostel.find((r) => r._id === h);
      return {
        hostel: h,
        label: HOSTEL_META[h].label,
        total: (row?.total as number) ?? 0,
        open: (row?.open as number) ?? 0,
        breached: (row?.breached as number) ?? 0,
        escalated: (row?.escalated as number) ?? 0,
        disputed: (row?.disputed as number) ?? 0,
      };
    }),
    performance: {
      avgResolveHours: Math.round((resolution?.avgResolveHours ?? 0) * 10) / 10,
      medianResolveHours: Math.round(median * 10) / 10,
      avgResponseHours: Math.round((resolution?.avgResponseHours ?? 0) * 10) / 10,
      resolvedCount: (resolution?.count as number) ?? 0,
      slaCompliancePercent:
        sla.total > 0 ? Math.round(((sla.total - sla.resolveBreached) / sla.total) * 100) : 100,
      ackCompliancePercent:
        sla.total > 0 ? Math.round(((sla.total - sla.ackBreached) / sla.total) * 100) : 100,
      reopenRatePercent: sla.total > 0 ? Math.round((sla.reopened / sla.total) * 100) : 0,
      disputeRatePercent: sla.total > 0 ? Math.round((sla.disputed / sla.total) * 100) : 0,
      avgRating: ratingStats[0]?.avg ? Math.round(ratingStats[0].avg * 10) / 10 : null,
      ratingCount: ratingStats[0]?.count ?? 0,
    },
    ageBuckets: AGE_BUCKETS.map((b) => ({ key: b.key, label: b.label, count: buckets[b.key] })),
    trend,
  };
}

/* ---------------------------------------------------------------------------
 * Accountability scorecards
 * ------------------------------------------------------------------------ */

export async function getStaffScorecards(actor: CurrentUser) {
  await connectDB();
  const match = scopeFilter(actor);

  const rows = await Complaint.aggregate([
    { $match: { ...match, "resolution.resolvedBy": { $ne: null } } },
    {
      $group: {
        _id: "$resolution.resolvedBy",
        name: { $first: "$resolution.resolvedByName" },
        role: { $first: "$resolution.resolvedByRole" },
        resolved: { $sum: 1 },
        onTime: { $sum: { $cond: ["$sla.resolveBreached", 0, 1] } },
        disputed: { $sum: { $cond: ["$isDisputed", 1, 0] } },
        reopened: { $sum: { $cond: [{ $gt: ["$reopenCount", 0] }, 1, 0] } },
        avgResolveHours: {
          $avg: { $divide: [{ $subtract: ["$resolution.resolvedAt", "$createdAt"] }, HOUR] },
        },
        avgRating: { $avg: "$verification.rating" },
      },
    },
    { $sort: { resolved: -1 } },
  ]);

  // Include staff who have resolved nothing yet — a blank row is informative.
  const allowed = visibleHostels(actor);
  const staffQuery: Record<string, unknown> = {
    role: { $in: ["RT", "WARDEN", "COORDINATOR"] },
    isActive: true,
  };
  if (allowed) {
    staffQuery.$or = [{ hostel: { $in: allowed } }, { role: { $in: ["WARDEN", "COORDINATOR"] } }];
  }
  const staff = await User.find(staffQuery as never).select("name role hostel").lean();

  return staff.map((person) => {
    const row = rows.find((r) => String(r._id) === String(person._id));
    const resolved = (row?.resolved as number) ?? 0;
    return {
      id: String(person._id),
      name: person.name,
      role: person.role,
      hostel: person.hostel ?? null,
      resolved,
      onTime: (row?.onTime as number) ?? 0,
      onTimePercent: resolved ? Math.round((((row?.onTime as number) ?? 0) / resolved) * 100) : null,
      disputed: (row?.disputed as number) ?? 0,
      disputeRatePercent: resolved
        ? Math.round((((row?.disputed as number) ?? 0) / resolved) * 100)
        : null,
      reopened: (row?.reopened as number) ?? 0,
      avgResolveHours: row?.avgResolveHours
        ? Math.round((row.avgResolveHours as number) * 10) / 10
        : null,
      avgRating: row?.avgRating ? Math.round((row.avgRating as number) * 10) / 10 : null,
    };
  });
}

/**
 * Cached in the warm container for PUBLIC_STATS_TTL_MS.
 *
 * The transparency board is anonymous, identical for every visitor, and covers
 * a 90-day window — so recomputing two aggregation pipelines per page view buys
 * nothing. It is also the page most likely to be linked publicly and hit in
 * bursts, which is exactly when a free M0 cluster struggles.
 */
type PublicStats = Awaited<ReturnType<typeof computePublicStats>>;

const globalForPublicStats = globalThis as unknown as {
  __hcmsPublicStats?: { value: PublicStats; fetchedAt: number };
};

const PUBLIC_STATS_TTL_MS = 120_000;

export async function getPublicStats(): Promise<PublicStats> {
  const cached = globalForPublicStats.__hcmsPublicStats;
  if (cached && Date.now() - cached.fetchedAt < PUBLIC_STATS_TTL_MS) return cached.value;

  const value = await computePublicStats();
  globalForPublicStats.__hcmsPublicStats = { value, fetchedAt: Date.now() };
  return value;
}

async function computePublicStats() {
  await connectDB();

  const since = new Date(Date.now() - 90 * 24 * HOUR);

  const [rows, categories] = await Promise.all([
    Complaint.aggregate([
    { $match: { deletedAt: null, createdAt: { $gte: since } } },
    {
      $group: {
        _id: "$hostel",
        total: { $sum: 1 },
        open: { $sum: { $cond: [{ $in: ["$status", [...OPEN_STATUSES]] }, 1, 0] } },
        closed: { $sum: { $cond: [{ $in: ["$status", [...OPEN_STATUSES]] }, 0, 1] } },
        breached: { $sum: { $cond: ["$sla.resolveBreached", 1, 0] } },
        disputed: { $sum: { $cond: ["$isDisputed", 1, 0] } },
        avgResolveHours: {
          $avg: {
            $cond: [
              { $ne: ["$resolution.resolvedAt", null] },
              { $divide: [{ $subtract: ["$resolution.resolvedAt", "$createdAt"] }, HOUR] },
              null,
            ],
          },
        },
        avgRating: { $avg: "$verification.rating" },
        },
      },
    ]),
    Complaint.aggregate([
      { $match: { deletedAt: null, createdAt: { $gte: since } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]),
  ]);

  return {
    windowDays: 90,
    hostels: HOSTELS.map((h) => {
      const row = rows.find((r) => r._id === h);
      const total = (row?.total as number) ?? 0;
      const breached = (row?.breached as number) ?? 0;
      return {
        hostel: h,
        label: HOSTEL_META[h].label,
        total,
        open: (row?.open as number) ?? 0,
        closed: (row?.closed as number) ?? 0,
        disputed: (row?.disputed as number) ?? 0,
        slaCompliancePercent: total ? Math.round(((total - breached) / total) * 100) : 100,
        avgResolveHours: row?.avgResolveHours
          ? Math.round((row.avgResolveHours as number) * 10) / 10
          : null,
        avgRating: row?.avgRating ? Math.round((row.avgRating as number) * 10) / 10 : null,
      };
    }),
    topCategories: categories.map((c) => ({
      category: c._id as Category,
      label: CATEGORY_META[c._id as Category]?.label ?? String(c._id),
      count: c.count as number,
    })),
    totals: {
      total: rows.reduce((sum, r) => sum + (r.total as number), 0),
      open: rows.reduce((sum, r) => sum + (r.open as number), 0),
      closed: rows.reduce((sum, r) => sum + (r.closed as number), 0),
    },
  };
}

export { CATEGORIES, STATUS_META };
