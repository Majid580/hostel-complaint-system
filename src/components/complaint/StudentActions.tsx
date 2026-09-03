"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowUpCircle,
  CheckCircle2,
  Clock,
  RotateCcw,
  ShieldAlert,
  Star,
  ThumbsUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardContent, Field, Textarea } from "@/components/ui/primitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/overlays";
import { api, errorMessage } from "@/lib/apiClient";
import { cn, formatDateTime } from "@/lib/utils";

export type StudentActionState = {
  id: string;
  code: string;
  status: string;
  isDisputed: boolean;
  escalationLevel: number;
  hasUpvoted: boolean;
  upvoteCount: number;
  escalation: {
    canEscalate: boolean;
    escalateReason: string;
    escalateAvailableAt: string | null;
    canFlagFalseResolution: boolean;
    flagReason: string;
    flagAvailableAt: string | null;
  };
};

/**
 * Everything a student is allowed to do. Note what is NOT here: no status
 * dropdown, no assignment, no editing. The student panel is read-only on the
 * workflow — they can only confirm, dispute, escalate and comment.
 */
export function StudentActions({ complaint }: { complaint: StudentActionState }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "escalate" | "flag" | "reopen" | "verify">(null);
  const [reason, setReason] = useState("");
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    setDialog(null);
    setReason("");
    setError("");
    setRating(0);
  };

  const run = async (fn: () => Promise<{ message?: string }>, fallback: string) => {
    setBusy(true);
    setError("");
    try {
      const result = await fn();
      toast.success(result.message ?? fallback);
      close();
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const isResolved = complaint.status === "RESOLVED";
  const esc = complaint.escalation;

  return (
    <>
      <Card>
        <CardContent className="space-y-4 p-5 pt-5">
          <h2 className="font-semibold">What you can do</h2>

          {/* ---------- Resolved: confirm or dispute ---------- */}
          {isResolved && (
            <div className="space-y-3">
              <Alert tone="success" title="Staff say this is fixed">
                Please check it yourself. Confirming closes the complaint. If it is not actually
                fixed, say so — the complaint reopens and staff are told.
              </Alert>
              <div className="flex flex-wrap gap-2">
                <Button variant="success" onClick={() => setDialog("verify")}>
                  <CheckCircle2 />
                  Yes, it is fixed
                </Button>
                <Button variant="outline" onClick={() => setDialog("reopen")}>
                  <RotateCcw />
                  No, it is still broken
                </Button>
              </div>
            </div>
          )}

          {/* ---------- G7: false-resolution flag ---------- */}
          {isResolved && (
            <div
              className={cn(
                "rounded-xl border p-3.5",
                esc.canFlagFalseResolution
                  ? "border-destructive/40 bg-destructive/6"
                  : "border-border bg-muted/40",
              )}
            >
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <ShieldAlert
                  className={cn("size-4", esc.canFlagFalseResolution && "text-destructive")}
                />
                Marked done but never fixed?
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{esc.flagReason}</p>
              {esc.flagAvailableAt && !esc.canFlagFalseResolution && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5" />
                  Available from {formatDateTime(esc.flagAvailableAt)}
                </p>
              )}
              <Button
                variant="destructive"
                size="sm"
                className="mt-2.5"
                disabled={!esc.canFlagFalseResolution}
                onClick={() => setDialog("flag")}
              >
                <ShieldAlert />
                Report this to the Hostel Warden
              </Button>
            </div>
          )}

          {/* ---------- G6: escalate after 24 h ---------- */}
          {!isResolved && (
            <div
              className={cn(
                "rounded-xl border p-3.5",
                esc.canEscalate ? "border-warning/50 bg-warning/8" : "border-border bg-muted/40",
              )}
            >
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <ArrowUpCircle className={cn("size-4", esc.canEscalate && "text-warning")} />
                Nothing happening?
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {esc.escalateReason}
              </p>
              {esc.escalateAvailableAt && !esc.canEscalate && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5" />
                  Available from {formatDateTime(esc.escalateAvailableAt)}
                </p>
              )}
              <Button
                variant="warning"
                size="sm"
                className="mt-2.5"
                disabled={!esc.canEscalate}
                onClick={() => setDialog("escalate")}
              >
                <ArrowUpCircle />
                {complaint.escalationLevel === 0
                  ? "Escalate to the Hostel Warden"
                  : "Escalate to the Campus Coordinator"}
              </Button>
            </div>
          )}

          {complaint.isDisputed && (
            <Alert tone="danger" title="Reported to the Warden">
              You reported that this work was marked done but never completed. The Hostel Warden and
              the Campus Coordinator have both been notified and this is on the record.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* ================= Dialogs ================= */}

      <Dialog open={dialog === "escalate"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escalate to the Hostel Warden</DialogTitle>
            <DialogDescription>
              The Warden and your Resident Tutor will both be e-mailed, and this complaint moves to
              the top of the queue. Tell them what is still wrong.
            </DialogDescription>
          </DialogHeader>

          {error && <Alert tone="danger">{error}</Alert>}

          <Field
            label="Why are you escalating?"
            htmlFor="escalate-reason"
            hint="At least 10 characters"
            required
          >
            <Textarea
              id="escalate-reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="It has been two days and nobody has come to look at it. There is still no electricity in the room and we cannot study at night."
            />
          </Field>

          <DialogFooter>
            <Button variant="ghost" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="warning"
              disabled={busy || reason.trim().length < 10}
              onClick={() =>
                run(
                  () =>
                    api.post<{ message: string }>(`/api/complaints/${complaint.id}/escalate`, {
                      reason: reason.trim(),
                    }),
                  "Escalated.",
                )
              }
            >
              {busy ? "Escalating…" : "Escalate now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "flag"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report a false resolution</DialogTitle>
            <DialogDescription>
              This reopens the complaint, marks it as disputed, and e-mails the Hostel Warden and
              the Campus Coordinator with the name of whoever marked it resolved. Use it only when
              the work genuinely was not done.
            </DialogDescription>
          </DialogHeader>

          {error && <Alert tone="danger">{error}</Alert>}

          <Field
            label="What is still not done?"
            htmlFor="flag-reason"
            hint="At least 10 characters. Be specific — this goes on the record."
            required
          >
            <Textarea
              id="flag-reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="It was marked fixed two days ago but nobody ever came to the room. The socket is exactly as it was and there is still no power."
            />
          </Field>

          <DialogFooter>
            <Button variant="ghost" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy || reason.trim().length < 10}
              onClick={() =>
                run(
                  () =>
                    api.post<{ message: string }>(
                      `/api/complaints/${complaint.id}/flag-false-resolution`,
                      { reason: reason.trim() },
                    ),
                  "Reported to the Warden.",
                )
              }
            >
              {busy ? "Reporting…" : "Report to the Warden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "reopen"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>The problem is not fixed</DialogTitle>
            <DialogDescription>
              This reopens the complaint and tells your Resident Tutor that the work is incomplete.
            </DialogDescription>
          </DialogHeader>

          {error && <Alert tone="danger">{error}</Alert>}

          <Field
            label="What is still wrong?"
            htmlFor="reopen-reason"
            hint="At least 10 characters"
            required
          >
            <Textarea
              id="reopen-reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="The fan was replaced but it still makes the same noise and wobbles."
            />
          </Field>

          <DialogFooter>
            <Button variant="ghost" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button
              disabled={busy || reason.trim().length < 10}
              onClick={() =>
                run(
                  () =>
                    api.patch<{ message: string }>(`/api/complaints/${complaint.id}/status`, {
                      to: "REOPENED",
                      reason: reason.trim(),
                    }),
                  "Complaint reopened.",
                )
              }
            >
              {busy ? "Reopening…" : "Reopen the complaint"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "verify"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm the problem is fixed</DialogTitle>
            <DialogDescription>
              This closes the complaint. Your rating helps the hostel track which work actually
              lasts.
            </DialogDescription>
          </DialogHeader>

          {error && <Alert tone="danger">{error}</Alert>}

          <div>
            <p className="mb-1.5 text-sm font-medium">How was the repair?</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  aria-label={`${value} star${value === 1 ? "" : "s"}`}
                  className="rounded-md p-1 transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Star
                    className={cn(
                      "size-6",
                      value <= rating ? "fill-warning text-warning" : "text-muted-foreground",
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          <Field label="Anything to add?" htmlFor="verify-feedback" hint="Optional">
            <Textarea
              id="verify-feedback"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="The electrician came the same evening and replaced the whole socket. Thank you."
            />
          </Field>

          <DialogFooter>
            <Button variant="ghost" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="success"
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    api.post<{ message: string }>(`/api/complaints/${complaint.id}/verify`, {
                      rating: rating || undefined,
                      feedback: reason.trim() || undefined,
                    }),
                  "Complaint closed. Thank you.",
                )
              }
            >
              {busy ? "Closing…" : "Confirm and close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** "Me too" button used on the hostel feed. */
export function UpvoteButton({
  complaintId,
  initialCount,
  initialUpvoted,
}: {
  complaintId: string;
  initialCount: number;
  initialUpvoted: boolean;
}) {
  const [count, setCount] = useState(initialCount);
  const [upvoted, setUpvoted] = useState(initialUpvoted);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      const result = await api.post<{ upvoted: boolean; count: number }>(
        `/api/complaints/${complaintId}/upvote`,
      );
      setUpvoted(result.upvoted);
      setCount(result.count);
      toast.success(
        result.upvoted
          ? "Marked as affecting you too — this raises its priority."
          : "Removed your support.",
      );
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant={upvoted ? "default" : "outline"}
      size="sm"
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={upvoted}
    >
      <ThumbsUp />
      {upvoted ? "Affects me too" : "This affects me too"}
      {count > 0 && <span className="tabular-nums">· {count}</span>}
    </Button>
  );
}
