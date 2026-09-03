import Link from "next/link";
import { redirect } from "next/navigation";
import { ScrollText } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Complaint, ComplaintEvent, SystemLog } from "@/models";
import { canViewAuditLog, visibleHostels } from "@/lib/auth/permissions";
import { Badge, Card, CardContent, EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { describeEvent } from "@/lib/services/events";
import { formatDateTime, relativeTime } from "@/lib/utils";
import { EVENT_ACTIONS, ROLE_META } from "@/lib/domain/constants";

export const metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canViewAuditLog(user)) redirect("/staff");

  const params = await searchParams;
  const action = EVENT_ACTIONS.includes(params.action as never) ? params.action : undefined;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  await connectDB();

  // RTs never reach this page, but a Warden is still scoped by `visibleHostels`
  // if the role model ever changes.
  const allowed = visibleHostels(user);
  let complaintIds: string[] | null = null;
  if (allowed) {
    const scoped = await Complaint.find({ hostel: { $in: allowed } })
      .select("_id")
      .limit(5000)
      .lean();
    complaintIds = scoped.map((c) => String(c._id));
  }

  const query: Record<string, unknown> = {};
  if (action) query.action = action;
  if (complaintIds) query.complaintId = { $in: complaintIds };

  const [events, total, systemLogs] = await Promise.all([
    ComplaintEvent.find(query as never)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    ComplaintEvent.countDocuments(query as never),
    page === 1
      ? SystemLog.find({}).sort({ createdAt: -1 }).limit(10).lean()
      : Promise.resolve([]),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-bold">Audit log</h1>
        <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground text-pretty">
          Every action ever taken on a complaint, in order. Entries are append-only — nothing here
          can be edited or deleted by anyone, including the Campus Coordinator.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Link href="/staff/audit">
          <Button variant={!action ? "default" : "outline"} size="sm">
            All actions
          </Button>
        </Link>
        {(
          [
            "ESCALATED",
            "FALSE_RESOLUTION_FLAGGED",
            "STATUS_CHANGED",
            "WORKER_ASSIGNED",
            "REJECTED",
            "SEVERITY_CHANGED",
          ] as const
        ).map((a) => (
          <Link key={a} href={`/staff/audit?action=${a}`}>
            <Button variant={action === a ? "default" : "outline"} size="sm">
              {a.replaceAll("_", " ").toLowerCase()}
            </Button>
          </Link>
        ))}
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="size-6" />}
          title="Nothing recorded yet"
          description="Actions appear here as soon as complaints start moving through the system."
        />
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {events.map((event) => (
              <Link
                key={String(event._id)}
                href={`/staff/complaints/${event.complaintId}`}
                className="flex flex-wrap items-start gap-3 p-4 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">
                    {describeEvent(event as never)}
                  </p>
                  {event.message && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {event.message}
                    </p>
                  )}
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-mono">{event.complaintCode}</span>
                    <span>·</span>
                    <span>
                      {event.actorName}
                      {event.actorRole !== "SYSTEM"
                        ? ` (${ROLE_META[event.actorRole as keyof typeof ROLE_META]?.short ?? event.actorRole})`
                        : ""}
                    </span>
                    <span>·</span>
                    <time dateTime={new Date(event.createdAt).toISOString()}>
                      {formatDateTime(event.createdAt)}
                    </time>
                    {event.ip && <span className="hidden sm:inline">· {event.ip}</span>}
                  </p>
                </div>
                <Badge tone={event.visibility === "INTERNAL" ? "neutral" : "outline"} size="sm">
                  {event.action.replaceAll("_", " ").toLowerCase()}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-between" aria-label="Pagination">
          <span className="text-sm text-muted-foreground">
            Page {page} of {pages} · {total} entries
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/staff/audit?${action ? `action=${action}&` : ""}page=${page - 1}`}>
                <Button variant="outline" size="sm">
                  Previous
                </Button>
              </Link>
            )}
            {page < pages && (
              <Link href={`/staff/audit?${action ? `action=${action}&` : ""}page=${page + 1}`}>
                <Button variant="outline" size="sm">
                  Next
                </Button>
              </Link>
            )}
          </div>
        </nav>
      )}

      {systemLogs.length > 0 && (
        <Card>
          <CardContent className="p-5 pt-5">
            <h2 className="font-semibold">System log</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Scheduled sweeps, e-mail failures and settings changes.
            </p>
            <ul className="mt-3 space-y-2">
              {systemLogs.map((log) => (
                <li key={String(log._id)} className="flex items-start gap-2 text-xs">
                  <Badge
                    tone={
                      log.level === "ERROR" ? "danger" : log.level === "WARN" ? "warning" : "neutral"
                    }
                    size="sm"
                  >
                    {log.level}
                  </Badge>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{log.source}</span> — {log.message}
                    <span className="ml-1 text-muted-foreground">
                      ({relativeTime(log.createdAt)})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
