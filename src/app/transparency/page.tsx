import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock3, Scale, ShieldCheck, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardContent, EmptyState } from "@/components/ui/primitives";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { getPublicStats } from "@/lib/services/analytics";
import { publicEnv } from "@/lib/config/env";

export const metadata: Metadata = {
  title: "Transparency board",
  description:
    "Anonymised hostel complaint statistics — volume, resolution times and SLA compliance for every hostel, published openly.",
};

/** Reads the database on every request, so it must never be prerendered. */
export const dynamic = "force-dynamic";

type Stats = Awaited<ReturnType<typeof getPublicStats>>;

export default async function TransparencyPage() {
  let stats: Stats | null = null;
  try {
    stats = await getPublicStats();
  } catch {
    stats = null;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader current="transparency" />

      <main id="main" className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
          <header className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Scale className="size-3.5" />
              Open to everyone · no sign-in
            </span>
            <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
              Transparency board
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground text-pretty">
              How {publicEnv.instituteName} hostels are actually performing, from the last{" "}
              {stats?.windowDays ?? 90} days of complaints. These are counts and averages only —
              no complaint text, no photographs, and no student is ever identifiable here.
            </p>
          </header>

          {!stats ? (
            <div className="mt-8">
              <EmptyState
                icon={<AlertTriangle className="size-5" />}
                title="Statistics are temporarily unavailable"
                description="The board could not be loaded just now. Please try again in a few minutes."
              />
            </div>
          ) : stats.totals.total === 0 ? (
            <div className="mt-8">
              <EmptyState
                icon={<ShieldCheck className="size-5" />}
                title="No complaints in this window"
                description={`Nothing has been filed in the last ${stats.windowDays} days. Figures appear here as soon as complaints come in.`}
              />
            </div>
          ) : (
            <>
              {/* ---------- Headline totals ---------- */}
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <Headline label="Complaints filed" value={stats.totals.total} />
                <Headline label="Still open" value={stats.totals.open} />
                <Headline label="Closed" value={stats.totals.closed} />
              </div>

              {/* ---------- Per hostel ---------- */}
              <section className="mt-10">
                <h2 className="font-display text-xl font-bold">By hostel</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  SLA compliance is the share of complaints resolved inside the deadline set for
                  their severity.
                </p>

                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  {stats.hostels.map((h) => (
                    <Card key={h.hostel}>
                      <CardContent className="p-5 pt-5">
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="font-semibold">{h.label}</h3>
                          <span className="text-xs text-muted-foreground">
                            {h.total} complaint{h.total === 1 ? "" : "s"}
                          </span>
                        </div>

                        <div className="mt-4">
                          <div className="flex items-baseline justify-between">
                            <span className="text-xs font-medium text-muted-foreground">
                              SLA compliance
                            </span>
                            <span className="font-display text-lg font-bold tabular-nums">
                              {h.slaCompliancePercent}%
                            </span>
                          </div>
                          <div
                            className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
                            role="img"
                            aria-label={`${h.label}: ${h.slaCompliancePercent}% of complaints resolved within the deadline`}
                          >
                            <div
                              className={`h-full rounded-full ${complianceTone(h.slaCompliancePercent)}`}
                              style={{ width: `${h.slaCompliancePercent}%` }}
                            />
                          </div>
                        </div>

                        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
                          <Stat label="Open" value={h.open} />
                          <Stat label="Closed" value={h.closed} />
                          <Stat
                            label="Avg. time to resolve"
                            value={h.avgResolveHours === null ? "—" : `${h.avgResolveHours} h`}
                            icon={<Clock3 className="size-3.5" />}
                          />
                          <Stat
                            label="Student rating"
                            value={h.avgRating === null ? "—" : `${h.avgRating} / 5`}
                            icon={<Star className="size-3.5" />}
                          />
                        </dl>

                        {h.disputed > 0 && (
                          <p className="mt-3 text-xs text-destructive">
                            {h.disputed} resolution{h.disputed === 1 ? " was" : "s were"} disputed by
                            the student who reported the problem.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>

              {/* ---------- Categories ---------- */}
              {stats.topCategories.length > 0 && (
                <section className="mt-10">
                  <h2 className="font-display text-xl font-bold">What students report most</h2>
                  <Card className="mt-4">
                    <CardContent className="p-5 pt-5">
                      <ul className="space-y-3.5">
                        {stats.topCategories.map((c) => {
                          const share = Math.round((c.count / stats.topCategories[0].count) * 100);
                          return (
                            <li key={c.category}>
                              <div className="flex items-baseline justify-between gap-3 text-sm">
                                <span className="font-medium">{c.label}</span>
                                <span className="tabular-nums text-muted-foreground">{c.count}</span>
                              </div>
                              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${share}%` }}
                                />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </CardContent>
                  </Card>
                </section>
              )}
            </>
          )}

          <Alert tone="info" className="mt-10">
            Figures cover the last {stats?.windowDays ?? 90} days and update continuously. A
            complaint counts as breached when it passes the resolution deadline for its severity,
            whether or not it was later fixed.
          </Alert>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register">
              <Button>
                File a complaint
                <ArrowRight />
              </Button>
            </Link>
            <Link href="/track">
              <Button variant="outline">Track an existing complaint</Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function complianceTone(percent: number): string {
  if (percent >= 85) return "bg-success";
  if (percent >= 60) return "bg-warning";
  return "bg-destructive";
}

function Headline({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-5 pt-5">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
