"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertOctagon, Loader2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardContent, Field, Input, Textarea } from "@/components/ui/primitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";
import { ImageUploader } from "@/components/media/ImageUploader";
import type { UploadedAttachment } from "@/components/media/useUpload";
import { api, errorMessage } from "@/lib/apiClient";
import { SEVERITIES, SEVERITY_META, type Hostel, type Severity } from "@/lib/domain/constants";

export type StaffAction = {
  to: string;
  label: string;
  description: string;
  intent: "default" | "primary" | "success" | "warning" | "danger";
  requires: {
    note?: boolean;
    proofImages?: boolean;
    worker?: boolean;
    holdUntil?: boolean;
    reason?: boolean;
  };
};

type WorkerOption = {
  id: string;
  name: string;
  tradeLabel: string;
  stats: { open: number; onTimeRate: number; reopenRate: number };
};

const VARIANT: Record<StaffAction["intent"], "default" | "success" | "warning" | "destructive" | "outline"> = {
  default: "outline",
  primary: "default",
  success: "success",
  warning: "warning",
  danger: "destructive",
};

export function StaffActions({
  complaintId,
  hostel,
  actions,
  currentSeverity,
  requireProof,
}: {
  complaintId: string;
  hostel: Hostel;
  actions: StaffAction[];
  currentSeverity: Severity;
  requireProof: boolean;
}) {
  const router = useRouter();

  const [open, setOpen] = useState<StaffAction | null>(null);
  const [severityOpen, setSeverityOpen] = useState(false);

  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [holdUntil, setHoldUntil] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [expected, setExpected] = useState("");
  const [proofImages, setProofImages] = useState<UploadedAttachment[]>([]);
  const [severity, setSeverity] = useState<Severity>(currentSeverity);

  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [workersLoaded, setWorkersLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const needsWorker = Boolean(open?.requires.worker);

  // Derived rather than stored, so nothing has to be set synchronously on mount.
  const loadingWorkers = needsWorker && !workersLoaded;

  useEffect(() => {
    if (!needsWorker || workersLoaded) return;
    let cancelled = false;
    api
      .get<{ workers: WorkerOption[] }>(`/api/workers?activeOnly=true&hostel=${hostel}`)
      .then((data) => {
        if (!cancelled) setWorkers(data.workers);
      })
      .catch(() => toast.error("Could not load the worker list."))
      .finally(() => {
        if (!cancelled) setWorkersLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [needsWorker, hostel, workersLoaded]);

  const reset = () => {
    setOpen(null);
    setSeverityOpen(false);
    setNote("");
    setReason("");
    setHoldUntil("");
    setWorkerId("");
    setExpected("");
    setProofImages([]);
    setError("");
  };

  const canSubmit = (() => {
    if (!open) return false;
    const r = open.requires;
    if (r.reason && reason.trim().length < 10) return false;
    if (r.note && note.trim().length < 10) return false;
    if (r.proofImages && requireProof && proofImages.length === 0) return false;
    if (r.holdUntil && !holdUntil) return false;
    if (r.worker && !workerId) return false;
    return true;
  })();

  const submit = async () => {
    if (!open) return;
    setBusy(true);
    setError("");
    try {
      await api.patch(`/api/complaints/${complaintId}/status`, {
        to: open.to,
        note: note.trim() || undefined,
        reason: reason.trim() || undefined,
        holdUntil: holdUntil ? new Date(holdUntil).toISOString() : undefined,
        proofImages: proofImages.length ? proofImages : undefined,
        workerId: workerId || undefined,
        expectedCompletionAt: expected ? new Date(expected).toISOString() : undefined,
      });
      toast.success(`${open.label} — done.`);
      reset();
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const submitSeverity = async () => {
    setBusy(true);
    setError("");
    try {
      await api.patch(`/api/complaints/${complaintId}/severity`, {
        severity,
        reason: reason.trim(),
      });
      toast.success("Severity updated. The SLA clocks have been recalculated.");
      reset();
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="space-y-3 p-5 pt-5">
          <h2 className="font-semibold">Actions</h2>

          {actions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No further action is possible from this status.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {actions.map((action) => (
                <Button
                  key={action.to + action.label}
                  variant={VARIANT[action.intent]}
                  className="justify-start"
                  onClick={() => {
                    reset();
                    setOpen(action);
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}

          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              reset();
              setSeverity(currentSeverity);
              setSeverityOpen(true);
            }}
          >
            <AlertOctagon />
            Change severity
          </Button>
        </CardContent>
      </Card>

      {/* ================= Transition dialog ================= */}
      <Dialog open={Boolean(open)} onOpenChange={(o) => !o && reset()}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{open?.label}</DialogTitle>
            <DialogDescription>{open?.description}</DialogDescription>
          </DialogHeader>

          {error && <Alert tone="danger">{error}</Alert>}

          {open?.requires.worker && (
            <>
              <Field
                label="Worker"
                htmlFor="worker"
                hint="Only active workers who serve this hostel are listed."
                required
              >
                {loadingWorkers ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading workers…
                  </div>
                ) : workers.length === 0 ? (
                  <Alert tone="warning">
                    No active workers are registered for this hostel yet. Add one under{" "}
                    <strong>Workers</strong> first.
                  </Alert>
                ) : (
                  <Select value={workerId} onValueChange={setWorkerId}>
                    <SelectTrigger id="worker">
                      <SelectValue placeholder="Choose a worker" />
                    </SelectTrigger>
                    <SelectContent>
                      {workers.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name} · {w.tradeLabel}
                          {w.stats.open > 0 ? ` · ${w.stats.open} open` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>

              <Field
                label="Expected completion"
                htmlFor="expected"
                hint="Shown to the student, and used to measure whether the job was on time."
              >
                <Input
                  id="expected"
                  type="datetime-local"
                  value={expected}
                  onChange={(e) => setExpected(e.target.value)}
                />
              </Field>
            </>
          )}

          {open?.requires.note && (
            <Field
              label="What was done?"
              htmlFor="note"
              hint="At least 10 characters. The student reads this and confirms it."
              required
            >
              <Textarea
                id="note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Replaced the burnt socket and the wiring in the wall channel. Tested with a load; power is stable."
              />
            </Field>
          )}

          {open?.requires.proofImages && (
            <ImageUploader
              value={proofImages}
              onChange={setProofImages}
              max={5}
              folder="proofs"
              label="Proof of the completed work"
              hint={
                requireProof
                  ? "At least one photo is required. This is what stops complaints being closed without the work being done."
                  : "Optional, but strongly recommended."
              }
            />
          )}

          {open?.requires.reason && (
            <Field
              label="Reason"
              htmlFor="reason"
              hint="At least 10 characters. This is shown to the student and recorded permanently."
              required
            >
              <Textarea
                id="reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Waiting for the replacement part to arrive from the supplier."
              />
            </Field>
          )}

          {open?.requires.holdUntil && (
            <Field label="Expected to resume on" htmlFor="holdUntil" required>
              <Input
                id="holdUntil"
                type="date"
                value={holdUntil}
                onChange={(e) => setHoldUntil(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </Field>
          )}

          {!open?.requires.note && !open?.requires.reason && (
            <Field label="Note" htmlFor="optional-note" hint="Optional — added to the timeline.">
              <Textarea
                id="optional-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={reset} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant={open ? VARIANT[open.intent] : "default"}
              disabled={busy || !canSubmit}
              onClick={() => void submit()}
            >
              {busy ? "Saving…" : (open?.label ?? "Confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= Severity dialog ================= */}
      <Dialog open={severityOpen} onOpenChange={(o) => !o && reset()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change severity</DialogTitle>
            <DialogDescription>
              This recalculates the acknowledgement and resolution deadlines, and the change is
              recorded on the timeline with your name and reason.
            </DialogDescription>
          </DialogHeader>

          {error && <Alert tone="danger">{error}</Alert>}

          <Field label="New severity" htmlFor="severity" required>
            <Select value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
              <SelectTrigger id="severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SEVERITY_META[s].label} — resolve within {SEVERITY_META[s].resolveHours} h
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Why?"
            htmlFor="severity-reason"
            hint="At least 5 characters. Visible to the student."
            required
          >
            <Textarea
              id="severity-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Inspected on site — there is exposed live wiring, so this is a safety risk and needs same-day attention."
            />
          </Field>

          <DialogFooter>
            <Button variant="ghost" onClick={reset} disabled={busy}>
              Cancel
            </Button>
            <Button
              disabled={busy || reason.trim().length < 5 || severity === currentSeverity}
              onClick={() => void submitSeverity()}
            >
              {busy ? "Saving…" : "Update severity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Compact reassignment control shown when a worker is already assigned. */
export function ReassignButton({
  complaintId,
  hostel,
}: {
  complaintId: string;
  hostel: Hostel;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [workerId, setWorkerId] = useState("");
  const [expected, setExpected] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || workers.length) return;
    api
      .get<{ workers: WorkerOption[] }>(`/api/workers?activeOnly=true&hostel=${hostel}`)
      .then((data) => setWorkers(data.workers))
      .catch(() => toast.error("Could not load workers."));
  }, [open, hostel, workers.length]);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await api.patch(`/api/complaints/${complaintId}/assign`, {
        workerId,
        expectedCompletionAt: expected ? new Date(expected).toISOString() : undefined,
        remarks: remarks.trim() || undefined,
      });
      toast.success("Worker assigned. The student has been notified.");
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Wrench />
        Reassign
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign a different worker</DialogTitle>
            <DialogDescription>
              The student is e-mailed with the new worker&apos;s name and the expected completion
              date.
            </DialogDescription>
          </DialogHeader>

          {error && <Alert tone="danger">{error}</Alert>}

          <Field label="Worker" htmlFor="reassign-worker" required>
            <Select value={workerId} onValueChange={setWorkerId}>
              <SelectTrigger id="reassign-worker">
                <SelectValue placeholder="Choose a worker" />
              </SelectTrigger>
              <SelectContent>
                {workers.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name} · {w.tradeLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Expected completion" htmlFor="reassign-expected">
            <Input
              id="reassign-expected"
              type="datetime-local"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
            />
          </Field>

          <Field label="Instructions for the worker" htmlFor="reassign-remarks">
            <Textarea
              id="reassign-remarks"
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Bring a replacement socket and a tester."
            />
          </Field>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button disabled={busy || !workerId} onClick={() => void submit()}>
              {busy ? "Assigning…" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
