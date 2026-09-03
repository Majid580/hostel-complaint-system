"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCheck, Loader2, ShieldCheck, UserCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Checkbox, Field } from "@/components/ui/primitives";
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
import { api, errorMessage } from "@/lib/apiClient";
import { HOSTEL_META, TRADE_LABEL, type Hostel } from "@/lib/domain/constants";

/**
 * Selection for the staff queue (P7-9).
 *
 * The state lives in a client context so the cards themselves can stay server
 * components — only the checkbox and the action bar are interactive. Wrapping
 * `ComplaintCard` in a client component instead would have pulled its
 * render-time clock read onto the client and caused a hydration mismatch.
 */

type Selectable = { id: string; hostel: Hostel; code: string };

type SelectionContext = {
  items: Selectable[];
  selected: Set<string>;
  toggle: (id: string) => void;
  clear: () => void;
  selectAll: () => void;
};

const Ctx = createContext<SelectionContext | null>(null);

function useSelection(): SelectionContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Bulk selection components must be used inside <BulkSelectionProvider>");
  return ctx;
}

export function BulkSelectionProvider({
  items,
  children,
}: {
  items: Selectable[];
  children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // A new page of results makes any carried-over selection meaningless.
  const pageKey = items.map((i) => i.id).join(",");
  const [lastPage, setLastPage] = useState(pageKey);
  if (lastPage !== pageKey) {
    setLastPage(pageKey);
    setSelected(new Set());
  }

  const value = useMemo<SelectionContext>(
    () => ({
      items,
      selected,
      toggle: (id) =>
        setSelected((current) => {
          const next = new Set(current);
          if (!next.delete(id)) next.add(id);
          return next;
        }),
      clear: () => setSelected(new Set()),
      selectAll: () => setSelected(new Set(items.map((i) => i.id))),
    }),
    [items, selected],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function BulkCheckbox({ id, code }: { id: string; code: string }) {
  const { selected, toggle } = useSelection();
  return (
    <Checkbox
      checked={selected.has(id)}
      onCheckedChange={() => toggle(id)}
      aria-label={`Select complaint ${code}`}
      className="mt-4"
    />
  );
}

type WorkerOption = { id: string; name: string; trade: keyof typeof TRADE_LABEL };
type BulkAction = "ACKNOWLEDGE" | "ASSIGN" | "CLOSE";

const ACTION_META: Record<BulkAction, { label: string; title: string; description: string }> = {
  ACKNOWLEDGE: {
    label: "Acknowledge",
    title: "Acknowledge these complaints",
    description:
      "Marks each one as seen and stops the 24-hour escalation clock. The reporter is notified.",
  },
  ASSIGN: {
    label: "Assign worker",
    title: "Assign a worker to these complaints",
    description:
      "The same worker is assigned to every selected complaint. Each reporter is notified separately.",
  },
  CLOSE: {
    label: "Close",
    title: "Close these complaints",
    description:
      "Use only for complaints already confirmed as fixed. Closing is recorded against your name in every timeline.",
  },
};

export function BulkActionBar() {
  const router = useRouter();
  const { items, selected, clear, selectAll } = useSelection();

  const [action, setAction] = useState<BulkAction | null>(null);
  const [note, setNote] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [workersLoaded, setWorkersLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const chosen = items.filter((i) => selected.has(i.id));
  const hostels = [...new Set(chosen.map((i) => i.hostel))];
  // Workers serve one hostel, so a mixed-hostel selection cannot be assigned.
  const singleHostel = hostels.length === 1 ? hostels[0] : null;

  const needWorkers = action === "ASSIGN" && Boolean(singleHostel);
  const loadingWorkers = needWorkers && !workersLoaded;

  useEffect(() => {
    if (!needWorkers || workersLoaded || !singleHostel) return;
    let cancelled = false;
    api
      .get<{ workers: WorkerOption[] }>(`/api/workers?activeOnly=true&hostel=${singleHostel}`)
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
  }, [needWorkers, workersLoaded, singleHostel]);

  const close = () => {
    setAction(null);
    setNote("");
    setError("");
  };

  const run = async () => {
    if (!action) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.post<{
        requested: number;
        succeeded: number;
        skipped: { code: string | null; reason: string }[];
      }>("/api/complaints/bulk", {
        ids: chosen.map((i) => i.id),
        action,
        note: note.trim() || undefined,
        workerId: action === "ASSIGN" ? workerId : undefined,
      });

      if (result.succeeded > 0) {
        toast.success(
          `${result.succeeded} of ${result.requested} complaint${result.requested === 1 ? "" : "s"} updated.`,
        );
      }
      if (result.skipped.length > 0) {
        toast.warning(
          `${result.skipped.length} skipped — ${result.skipped[0].code ?? "one"}: ${result.skipped[0].reason}`,
          { duration: 8000 },
        );
      }
      if (result.succeeded === 0 && result.skipped.length === 0) {
        toast.info("Nothing changed.");
      }

      close();
      clear();
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const count = chosen.length;
  const allSelected = count > 0 && count === items.length;

  return (
    <>
      {/* Sticky bar, only once something is selected. */}
      {count > 0 && (
        <div className="sticky bottom-4 z-30 mx-auto w-full max-w-3xl" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2.5 shadow-lg">
            <span className="pl-1.5 text-sm font-medium">
              {count} selected
              {hostels.length > 1 && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  across {hostels.length} hostels
                </span>
              )}
            </span>

            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              {!allSelected && (
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  Select all {items.length}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setAction("ACKNOWLEDGE")}>
                <CheckCheck />
                Acknowledge
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAction("ASSIGN")}
                disabled={!singleHostel}
                title={
                  singleHostel
                    ? undefined
                    : "Workers serve a single hostel — select complaints from one hostel to assign."
                }
              >
                <UserCheck />
                Assign
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAction("CLOSE")}>
                <ShieldCheck />
                Close
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={clear} aria-label="Clear selection">
                <X />
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={Boolean(action)} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{action && ACTION_META[action].title}</DialogTitle>
            <DialogDescription>{action && ACTION_META[action].description}</DialogDescription>
          </DialogHeader>

          {error && <Alert tone="danger">{error}</Alert>}

          <p className="text-sm text-muted-foreground">
            {count} complaint{count === 1 ? "" : "s"} selected
            {singleHostel ? ` in ${HOSTEL_META[singleHostel].label}` : ""}. Any complaint that
            cannot legally make this change is skipped and reported back — the rest still go
            through.
          </p>

          {action === "ASSIGN" && (
            <Field
              label="Worker"
              htmlFor="bulk-worker"
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
                  <SelectTrigger id="bulk-worker">
                    <SelectValue placeholder="Choose a worker" />
                  </SelectTrigger>
                  <SelectContent>
                    {workers.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name} · {TRADE_LABEL[w.trade]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          )}

          <Field
            label="Note (optional)"
            htmlFor="bulk-note"
            hint="Added to every selected complaint's timeline."
          >
            <textarea
              id="bulk-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={2000}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Optional — the same note is recorded on each one."
            />
          </Field>

          <DialogFooter>
            <Button variant="ghost" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={() => void run()}
              disabled={busy || (action === "ASSIGN" && !workerId)}
              variant={action === "CLOSE" ? "warning" : "default"}
            >
              {busy && <Loader2 className="animate-spin" />}
              {busy ? "Applying…" : `${action ? ACTION_META[action].label : ""} ${count}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
