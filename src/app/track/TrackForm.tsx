"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Hammer,
  Search,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardContent, Field, Input } from "@/components/ui/primitives";
import { StatusStepper } from "@/components/complaint/StatusStepper";
import { CategoryBadge, HostelBadge, SeverityBadge, StatusBadge } from "@/components/shared/badges";
import { api, ApiClientError, errorMessage } from "@/lib/apiClient";
import type { Category, ComplaintStatus, Hostel, Severity } from "@/lib/domain/constants";

type TrackResult = {
  complaint: {
    code: string;
    title: string;
    hostel: Hostel;
    category: Category;
    severity: Severity;
    status: ComplaintStatus;
    statusLabel: string;
    statusDescription: string;
    escalationLevel: 0 | 1 | 2;
    isDisputed: boolean;
    assignedWorker: { name: string; trade: string; expectedCompletionAt: string | null } | null;
    resolvedAt: string | null;
    createdAt: string;
    resolveDueAt: string | null;
    resolveBreached: boolean;
  };
  timeline: { summary: string; createdAt: string; toStatus: ComplaintStatus | null }[];
};

const when = (value: string | null) => (value ? format(new Date(value), "d MMM yyyy, h:mm a") : "—");

export function TrackForm() {
  const [code, setCode] = useState("");
  const [regNo, setRegNo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [result, setResult] = useState<TrackResult | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setFields({});
    try {
      setResult(await api.post<TrackResult>("/api/complaints/track", { code, regNo }));
    } catch (caught) {
      setResult(null);
      if (caught instanceof ApiClientError && caught.fields) setFields(caught.fields);
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-5 pt-5">
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
            <Field
              label="Ticket number"
              htmlFor="code"
              hint="On your confirmation e-mail — for example HCMS-2026-000123."
              error={fields.code}
              required
            >
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="HCMS-2026-000123"
                autoComplete="off"
                spellCheck={false}
                required
              />
            </Field>

            <Field
              label="Registration number"
              htmlFor="regNo"
              hint="The number the complaint was filed under."
              error={fields.regNo}
              required
            >
              <Input
                id="regNo"
                value={regNo}
                onChange={(e) => setRegNo(e.target.value)}
                placeholder="2023-CS-580"
                autoComplete="off"
                spellCheck={false}
                required
              />
            </Field>

            <div className="sm:pt-[26px]">
              <Button type="submit" disabled={busy} className="w-full sm:w-auto">
                <Search />
                {busy ? "Looking up…" : "Track"}
              </Button>
            </div>
          </form>

          {error && (
            <Alert tone="danger" className="mt-4" icon={<AlertTriangle className="size-4" />}>
              {error}
            </Alert>
          )}
        </CardContent>
      </Card>

      {result && (
        <div aria-live="polite" className="space-y-5">
          <Card>
            <CardContent className="p-5 pt-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">{result.complaint.code}</p>
                  <h2 className="mt-1 font-display text-xl font-bold text-pretty">
                    {result.complaint.title}
                  </h2>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <StatusBadge status={result.complaint.status} />
                    <SeverityBadge severity={result.complaint.severity} />
                    <CategoryBadge category={result.complaint.category} />
                    <HostelBadge hostel={result.complaint.hostel} />
                  </div>
                </div>
              </div>

              <p className="mt-4 text-sm text-muted-foreground text-pretty">
                {result.complaint.statusDescription}
              </p>

              <div className="mt-5">
                <StatusStepper status={result.complaint.status} />
              </div>

              {result.complaint.isDisputed && (
                <Alert tone="danger" className="mt-4" icon={<AlertTriangle className="size-4" />}>
                  The reporter has disputed a resolution on this complaint. It is being reviewed by
                  the Warden.
                </Alert>
              )}

              {result.complaint.escalationLevel > 0 && (
                <Alert tone="warning" className="mt-4" icon={<AlertTriangle className="size-4" />}>
                  This complaint has been escalated to the{" "}
                  {result.complaint.escalationLevel === 1 ? "Hostel Warden" : "Campus Coordinator"}.
                </Alert>
              )}

              <dl className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-4">
                <Fact icon={<CalendarClock className="size-4" />} label="Filed on">
                  {when(result.complaint.createdAt)}
                </Fact>
                <Fact
                  icon={<Timer className="size-4" />}
                  label={result.complaint.resolveBreached ? "Was due by (overdue)" : "Due by"}
                  tone={result.complaint.resolveBreached ? "danger" : undefined}
                >
                  {when(result.complaint.resolveDueAt)}
                </Fact>
                <Fact icon={<Hammer className="size-4" />} label="Assigned to">
                  {result.complaint.assignedWorker
                    ? `${result.complaint.assignedWorker.name} · ${result.complaint.assignedWorker.trade}`
                    : "Not yet assigned"}
                </Fact>
                <Fact icon={<CheckCircle2 className="size-4" />} label="Resolved on">
                  {when(result.complaint.resolvedAt)}
                </Fact>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 pt-5">
              <h3 className="font-semibold">Progress</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Every recorded step, oldest first. Nothing here can be edited or removed.
              </p>

              <ol className="mt-4 space-y-0">
                {result.timeline.map((entry, index) => (
                  <li key={`${entry.createdAt}-${index}`} className="flex gap-3.5">
                    <div className="flex flex-col items-center">
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                      {index < result.timeline.length - 1 && (
                        <span className="w-px flex-1 bg-border" />
                      )}
                    </div>
                    <div className="pb-5">
                      <p className="text-sm text-pretty">{entry.summary}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{when(entry.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Alert tone="info">
            This public view deliberately hides the description, photos, voice note and any internal
            notes.{" "}
            <Link href="/login" className="font-medium text-foreground underline underline-offset-2">
              Sign in
            </Link>{" "}
            to see the full complaint, add a comment, or escalate it.
          </Alert>
        </div>
      )}
    </div>
  );
}

function Fact({
  icon,
  label,
  tone,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  tone?: "danger";
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className={`mt-1 text-sm ${tone === "danger" ? "text-destructive" : ""}`}>{children}</dd>
    </div>
  );
}
