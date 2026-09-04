import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertOctagon,
  ArrowRight,
  ArrowUpCircle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Inbox,
  Megaphone,
  ShieldAlert,
  Timer,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getOverview } from "@/lib/services/analytics";
import { listComplaints } from "@/lib/services/listComplaints";
import { Button } from "@/components/ui/button";
import { Card, CardContent, EmptyState, Progress } from "@/components/ui/primitives";
import { ComplaintCard } from "@/components/complaint/ComplaintCard";
import { HOSTEL_META, ROLE_META } from "@/lib/domain/constants";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function StaffDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "STUDENT") redirect("/student");

  const global = user.role === "WARDEN" || user.role === "COORDINATOR";

  const [overview, queue, escalations, breaches] = await Promise.all([
    getOverview(user, { days: 30 }),
    // These three panels show a fixed handful of cards and no pager, so the
    // matching countDocuments would be three wasted round trips.
    listComplaints(user, { view: "actionRequired", sort: "priority", page: 1, limit: 6 } as never, {
      withTotal: false,
    }),
    listComplaints(user, { escalated: true, view: "open", sort: "priority", page: 1, limit: 5 } as never, {
      withTotal: false,
    }),
    listComplaints(user, { slaBreached: true, view: "open", sort: "priority", page: 1, limit: 5 } as never, {
      withTotal: false,
    }),
  ]);

  const p = overview.performance;

  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[26px] font-semibold leading-tight sm:text-3xl">
            {global ? "All hostels" : user.hostel ? HOSTEL_META[user.hostel].label : "Dashboard"}
          </h1>
          <p className="mt-1 truncate text-[13px] text-muted-foreground">
            {ROLE_META[user.role].label} · {user.name}
          </p>
        </div>
        {/* The queue is a bottom-bar tab on a phone. */}
        <Link href="/staff/complaints" className="hidden lg:block">
          <Button variant="outline">
            <ClipboardList />
            Open the full queue
          </Button>
        </Link>
      </header>

      {/* ---------- KPI tiles ----------
          Number first, label second: on a phone this is scanned, not read. The
          explanatory hint is desktop-only — it costs a line per tile and the
          label already carries the meaning. */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Kpi
          label="Needs action"
          value={overview.totals.open - overview.totals.resolved}
          hint="Waiting on staff"
          icon={<Inbox className="size-4" />}
          href="/staff/complaints?view=actionRequired"
        />
        <Kpi
          label="Escalated"
          value={overview.totals.escalated}
          hint="With the Warden or Coordinator"
          icon={<ArrowUpCircle className="size-4" />}
          tone={overview.totals.escalated > 0 ? "danger" : undefined}
          href="/staff/complaints?escalated=true&view=open"
        />
        <Kpi
          label="Past deadline"
          value={overview.totals.breached}
          hint="SLA breached"
          icon={<Timer className="size-4" />}
          tone={overview.totals.breached > 0 ? "warning" : undefined}
          href="/staff/complaints?slaBreached=true&view=open"
        />
        <Kpi
          label="Disputed"
          value={overview.totals.disputed}
          hint="Marked done, student disagrees"
          icon={<ShieldAlert className="size-4" />}
          tone={overview.totals.disputed > 0 ? "danger" : undefined}
          href="/staff/complaints?disputed=true&view=open"
        />
      </div>

      {/* ---------- Performance ---------- */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-5 pt-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <TrendingUp className="size-4" />
              Performance
            </h2>

            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Metric
                label="SLA compliance"
                value={`${p.slaCompliancePercent}%`}
                sub="Resolved before the deadline"
              />
              <Metric
                label="Avg resolution"
                value={p.avgResolveHours ? `${p.avgResolveHours} h` : "—"}
                sub={p.medianResolveHours ? `Median ${p.medianResolveHours} h` : undefined}
              />
              <Metric
                label="Avg first response"
                value={p.avgResponseHours ? `${p.avgResponseHours} h` : "—"}
                sub={`${p.ackCompliancePercent}% acknowledged in time`}
              />
              <Metric
                label="Student rating"
                value={p.avgRating ? `${p.avgRating}/5` : "—"}
                sub={p.ratingCount ? `${p.ratingCount} rated` : "No ratings yet"}
              />
            </dl>

            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>SLA compliance</span>
                <span className="tabular-nums">{p.slaCompliancePercent}%</span>
              </div>
              <Progress
                value={p.slaCompliancePercent}
                indicatorClassName={
                  p.slaCompliancePercent >= 85
                    ? "bg-success"
                    : p.slaCompliancePercent >= 60
                      ? "bg-warning"
                      : "bg-destructive"
                }
              />
            </div>

            {(p.disputeRatePercent > 0 || p.reopenRatePercent > 0) && (
              <p className="mt-4 text-xs text-muted-foreground">
                {p.reopenRatePercent}% of complaints have been reopened at least once,{" "}
                {p.disputeRatePercent}% were disputed after being marked resolved.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ---------- Ageing ---------- */}
        <Card>
          <CardContent className="p-5 pt-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <Clock className="size-4" />
              How long open complaints have waited
            </h2>
            <ul className="mt-4 space-y-3">
              {overview.ageBuckets.map((bucket) => {
                const totalOpen = overview.ageBuckets.reduce((s, b) => s + b.count, 0) || 1;
                const share = Math.round((bucket.count / totalOpen) * 100);
                const bad = bucket.key === "d3_7" || bucket.key === "gt7d";
                return (
                  <li key={bucket.key}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{bucket.label}</span>
                      <span className="font-medium tabular-nums">{bucket.count}</span>
                    </div>
                    <Progress
                      value={share}
                      indicatorClassName={bad && bucket.count ? "bg-destructive" : "bg-primary"}
                    />
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* ---------- Escalations ---------- */}
      {escalations.complaints.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <AlertOctagon className="size-4 text-destructive" />
              Escalated to you
            </h2>
            <Link href="/staff/complaints?escalated=true&view=open">
              <Button variant="ghost" size="sm">
                See all
                <ArrowRight />
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {escalations.complaints.map((c) => (
              <ComplaintCard
                key={c.id}
                complaint={c}
                href={`/staff/complaints/${c.id}`}
                showHostel={global}
                showReporter
              />
            ))}
          </div>
        </section>
      )}

      {/* ---------- Breaches ---------- */}
      {breaches.complaints.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Timer className="size-4 text-warning" />
              Past their deadline
            </h2>
            <Link href="/staff/complaints?slaBreached=true&view=open">
              <Button variant="ghost" size="sm">
                See all
                <ArrowRight />
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {breaches.complaints.map((c) => (
              <ComplaintCard
                key={c.id}
                complaint={c}
                href={`/staff/complaints/${c.id}`}
                showHostel={global}
                showReporter
              />
            ))}
          </div>
        </section>
      )}

      {/* ---------- Priority queue ---------- */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Priority queue</h2>
          <Link href="/staff/complaints">
            <Button variant="ghost" size="sm">
              See all
              <ArrowRight />
            </Button>
          </Link>
        </div>

        {queue.complaints.length === 0 ? (
          overview.totals.total === 0 ? (
            // Day one. "Nothing is waiting, well done" would be a strange thing
            // to tell someone who has not done anything yet — and it hides the
            // one job that genuinely needs doing before students start filing.
            <EmptyState
              icon={<Wrench className="size-6" />}
              title="No complaints yet"
              description="That is expected on a new system. Register the electricians, plumbers and cleaning staff who attend to problems — a complaint cannot be assigned to anyone until they exist here."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Link href="/staff/workers">
                    <Button>
                      <Wrench />
                      Add your workers
                    </Button>
                  </Link>
                  <Link href="/staff/announcements">
                    <Button variant="outline">
                      <Megaphone />
                      Post a notice
                    </Button>
                  </Link>
                </div>
              }
            />
          ) : (
            <EmptyState
              icon={<CheckCircle2 className="size-6" />}
              title="Nothing is waiting on staff"
              description="Every complaint in your scope has been acknowledged, assigned or resolved. Well done."
            />
          )
        ) : (
          <div className="space-y-3">
            {queue.complaints.map((c) => (
              <ComplaintCard
                key={c.id}
                complaint={c}
                href={`/staff/complaints/${c.id}`}
                showHostel={global}
                showReporter
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon,
  tone,
  href,
}: {
  label: string;
  value: number;
  hint: string;
  icon: React.ReactNode;
  tone?: "danger" | "warning";
  href: string;
}) {
  const toneClass =
    tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-primary";

  return (
    <Link href={href}>
      <Card className="h-full transition-colors hover:border-primary/50">
        <CardContent className="p-3 pt-3 sm:p-4 sm:pt-4">
          <div className={`flex items-center gap-1.5 ${toneClass}`}>
            {icon}
            <span className="truncate text-[11.5px] font-medium sm:text-xs">{label}</span>
          </div>
          <p className="mt-1 font-display text-[28px] font-semibold leading-none tabular-nums sm:mt-1.5 sm:text-3xl">
            {value}
          </p>
          <p className="mt-1 hidden text-xs text-muted-foreground sm:block">{hint}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-display text-xl font-bold tabular-nums">{value}</dd>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
