import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Complaint } from "@/models";
import { requireStaff } from "@/lib/auth/session";
import { fail } from "@/lib/api/response";
import { canExportData, visibleHostels } from "@/lib/auth/permissions";
import { CATEGORY_META, HOSTEL_META, STATUS_META, TRADE_LABEL } from "@/lib/domain/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** RFC 4180 escaping — a description containing a comma must not break the file. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const COLUMNS = [
  "Ticket",
  "Status",
  "Severity",
  "Category",
  "Hostel",
  "Title",
  "Description",
  "Location",
  "Student name",
  "Registration no",
  "Room",
  "Filed at",
  "First response at",
  "Acknowledge due",
  "Resolve due",
  "Ack breached",
  "Resolve breached",
  "Assigned worker",
  "Trade",
  "Assigned at",
  "Expected completion",
  "Resolved by",
  "Resolved at",
  "Resolution note",
  "Verified at",
  "Verification method",
  "Rating",
  "Escalation level",
  "Disputed",
  "Reopen count",
  "Upvotes",
  "Priority score",
  "Resolution hours",
];

export async function GET(request: NextRequest) {
  const actor = await requireStaff().catch(() => null);
  if (!actor) return fail("UNAUTHENTICATED", "Please sign in.");
  if (!canExportData(actor)) {
    return fail("FORBIDDEN", "Only the Hostel Warden and the Campus Coordinator can export data.");
  }

  await connectDB();

  const query: Record<string, unknown> = { deletedAt: null };
  const allowed = visibleHostels(actor);
  if (allowed) query.hostel = { $in: allowed };

  const hostel = request.nextUrl.searchParams.get("hostel");
  if (hostel) query.hostel = hostel;

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.$gte = new Date(from);
    if (to) range.$lte = new Date(to);
    query.createdAt = range;
  }

  const complaints = await Complaint.find(query as never)
    .sort({ createdAt: -1 })
    .limit(5000)
    .lean();

  const lines = [COLUMNS.join(",")];

  for (const c of complaints) {
    const resolutionHours = c.resolution?.resolvedAt
      ? (
          (new Date(c.resolution.resolvedAt).getTime() - new Date(c.createdAt).getTime()) /
          3_600_000
        ).toFixed(1)
      : "";

    lines.push(
      [
        c.code,
        STATUS_META[c.status].label,
        c.severity,
        CATEGORY_META[c.category].label,
        HOSTEL_META[c.hostel].label,
        c.title,
        c.description,
        c.location ?? "",
        c.student.name,
        c.student.regNo,
        c.student.roomNo ?? "",
        c.createdAt,
        c.sla.firstResponseAt ?? "",
        c.sla.ackDueAt,
        c.sla.resolveDueAt,
        c.sla.ackBreached ? "YES" : "NO",
        c.sla.resolveBreached ? "YES" : "NO",
        c.assignment?.workerName ?? "",
        c.assignment ? TRADE_LABEL[c.assignment.trade] : "",
        c.assignment?.assignedAt ?? "",
        c.assignment?.expectedCompletionAt ?? "",
        c.resolution?.resolvedByName ?? "",
        c.resolution?.resolvedAt ?? "",
        c.resolution?.note ?? "",
        c.verification?.verifiedAt ?? "",
        c.verification?.method ?? "",
        c.verification?.rating ?? "",
        c.escalationLevel,
        c.isDisputed ? "YES" : "NO",
        c.reopenCount,
        c.upvoteCount,
        c.priorityScore,
        resolutionHours,
      ]
        .map(cell)
        .join(","),
    );
  }

  const filename = `hcms-complaints-${new Date().toISOString().slice(0, 10)}.csv`;

  // The BOM makes Excel open UTF-8 correctly on Windows.
  return new Response(`﻿${lines.join("\r\n")}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
