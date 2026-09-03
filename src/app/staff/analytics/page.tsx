import { redirect } from "next/navigation";
import Link from "next/link";
import { Download } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getOverview, getStaffScorecards } from "@/lib/services/analytics";
import { listWorkers } from "@/lib/services/workers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/primitives";
import { AnalyticsCharts } from "./AnalyticsCharts";
import { canExportData } from "@/lib/auth/permissions";
import { HOSTELS, HOSTEL_META, ROLE_META, type Hostel } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ hostel?: string; days?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "STUDENT") redirect("/student");

  const params = await searchParams;
  const hostel = HOSTELS.includes(params.hostel as Hostel) ? (params.hostel as Hostel) : undefined;
  const days = Math.min(Number(params.days ?? 30) || 30, 365);
  const global = user.role === "WARDEN" || user.role === "COORDINATOR";

  const [overview, scorecards, workers] = await Promise.all([
    getOverview(user, { hostel, days }),
    getStaffScorecards(user),
    listWorkers(user),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Analytics</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Last {days} days ·{" "}
            {hostel ? HOSTEL_META[hostel].label : global ? "all three hostels" : "your hostel"}
          </p>
        </div>
        {canExportData(user) && (
          <a href="/api/export/complaints" download>
            <Button variant="outline" size="sm">
              <Download />
              Export CSV
            </Button>
          </a>
        )}
      </header>

      {/* ---------- Scope switcher ---------- */}
      {global && (
        <div className="flex flex-wrap gap-2">
          <Link href={`/staff/analytics?days=${days}`}>
            <Button variant={!hostel ? "default" : "outline"} size="sm">
              All hostels
            </Button>
          </Link>
          {HOSTELS.map((h) => (
            <Link key={h} href={`/staff/analytics?hostel=${h}&days=${days}`}>
              <Button variant={hostel === h ? "default" : "outline"} size="sm">
                {HOSTEL_META[h].label}
              </Button>
            </Link>
          ))}
          <span className="mx-1 h-9 w-px bg-border" />
          {[7, 30, 90, 365].map((d) => (
            <Link
              key={d}
              href={`/staff/analytics?${hostel ? `hostel=${hostel}&` : ""}days=${d}`}
            >
              <Button variant={days === d ? "default" : "outline"} size="sm">
                {d === 365 ? "1 year" : `${d} days`}
              </Button>
            </Link>
          ))}
        </div>
      )}

      <AnalyticsCharts overview={overview} />

      {/* ---------- Staff scorecard ---------- */}
      <Card>
        <CardContent className="p-5 pt-5">
          <h2 className="font-semibold">Staff accountability</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Disputes are complaints a member of staff marked resolved that the student then reported
            as still pending.
          </p>

          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Resolved</TableHead>
                  <TableHead className="text-right">On time</TableHead>
                  <TableHead className="text-right">Avg time</TableHead>
                  <TableHead className="text-right">Disputed</TableHead>
                  <TableHead className="text-right">Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scorecards.map((person) => (
                  <TableRow key={person.id}>
                    <TableCell className="font-medium">{person.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {ROLE_META[person.role].short}
                      {person.hostel ? ` · ${HOSTEL_META[person.hostel].short}` : ""}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{person.resolved}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        person.onTimePercent !== null &&
                          person.onTimePercent < 60 &&
                          "font-medium text-destructive",
                        person.onTimePercent !== null &&
                          person.onTimePercent >= 85 &&
                          "font-medium text-success",
                      )}
                    >
                      {person.onTimePercent === null ? "—" : `${person.onTimePercent}%`}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {person.avgResolveHours === null ? "—" : `${person.avgResolveHours} h`}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        person.disputed > 0 && "font-medium text-destructive",
                      )}
                    >
                      {person.disputed}
                      {person.disputeRatePercent !== null && person.disputed > 0
                        ? ` (${person.disputeRatePercent}%)`
                        : ""}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {person.avgRating === null ? "—" : `${person.avgRating}/5`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ---------- Worker scorecard ---------- */}
      <Card>
        <CardContent className="p-5 pt-5">
          <h2 className="font-semibold">Worker performance</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            A high reopen rate means the job was marked complete but did not hold.
          </p>

          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Trade</TableHead>
                  <TableHead className="text-right">Assigned</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">On time</TableHead>
                  <TableHead className="text-right">Reopened</TableHead>
                  <TableHead className="text-right">Avg turnaround</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No workers registered yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  workers.map((worker) => (
                    <TableRow key={worker.id}>
                      <TableCell className="font-medium">
                        {worker.name}
                        {!worker.isActive && (
                          <span className="ml-1.5 text-xs text-muted-foreground">(inactive)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{worker.tradeLabel}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {worker.stats.assigned}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {worker.stats.completed}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          worker.stats.completed > 0 &&
                            worker.stats.onTimeRate < 60 &&
                            "font-medium text-destructive",
                        )}
                      >
                        {worker.stats.completed ? `${worker.stats.onTimeRate}%` : "—"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          worker.stats.reopenRate > 20 && "font-medium text-destructive",
                        )}
                      >
                        {worker.stats.completed ? `${worker.stats.reopenRate}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {worker.stats.avgTatHours ? `${worker.stats.avgTatHours} h` : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
