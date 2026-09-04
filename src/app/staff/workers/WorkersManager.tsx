"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HardHat, Phone, Plus, RotateCcw, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Alert,
  Badge,
  Card,
  CardContent,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Textarea,
} from "@/components/ui/primitives";
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
import { api, errorFields, errorMessage } from "@/lib/apiClient";
import type { SerializedWorker } from "@/lib/services/workers";
import { HOSTEL_META, TRADES, TRADE_LABEL, type Hostel, type Trade } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";

export function WorkersManager({
  initialWorkers,
  allowedHostels,
}: {
  initialWorkers: SerializedWorker[];
  allowedHostels: Hostel[];
}) {
  const router = useRouter();
  const [workers] = useState(initialWorkers);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SerializedWorker | null>(null);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    trade: "GENERAL" as Trade,
    hostels: allowedHostels.length === 1 ? allowedHostels : ([] as Hostel[]),
    notes: "",
    isActive: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      phone: "",
      trade: "GENERAL",
      hostels: allowedHostels.length === 1 ? allowedHostels : [],
      notes: "",
      isActive: true,
    });
    setError("");
    setFields({});
    setOpen(true);
  };

  const openEdit = (worker: SerializedWorker) => {
    setEditing(worker);
    setForm({
      name: worker.name,
      phone: worker.phone ?? "",
      trade: worker.trade,
      hostels: worker.hostels,
      notes: worker.notes ?? "",
      isActive: worker.isActive,
    });
    setError("");
    setFields({});
    setOpen(true);
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    setFields({});
    try {
      const payload = { ...form, phone: form.phone || undefined, notes: form.notes || undefined };
      if (editing) {
        await api.patch(`/api/workers/${editing.id}`, payload);
        toast.success("Worker updated.");
      } else {
        await api.post("/api/workers", payload);
        toast.success("Worker added.");
      }
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setFields(errorFields(caught));
    } finally {
      setBusy(false);
    }
  };

  // Only deactivation asks. Reactivating a worker has no downside.
  const [confirmOff, setConfirmOff] = useState<SerializedWorker | null>(null);

  const toggleActive = async (worker: SerializedWorker) => {
    if (worker.isActive) {
      setConfirmOff(worker);
      return;
    }
    await applyActive(worker);
  };

  const applyActive = async (worker: SerializedWorker) => {
    try {
      if (worker.isActive) {
        await api.delete(`/api/workers/${worker.id}`);
        toast.success(`${worker.name} deactivated.`);
      } else {
        await api.patch(`/api/workers/${worker.id}`, { isActive: true });
        toast.success(`${worker.name} reactivated.`);
      }
      router.refresh();
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  };

  const active = workers.filter((w) => w.isActive);
  const inactive = workers.filter((w) => !w.isActive);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Workers</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            The people jobs are assigned to. Their completion and reopen rates are what make
            assignment accountable.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus />
          Add a worker
        </Button>
      </header>

      {active.length === 0 && inactive.length === 0 ? (
        <EmptyState
          icon={<HardHat className="size-6" />}
          title="No workers registered yet"
          description="Add the electricians, plumbers, carpenters and cleaning staff who actually attend to complaints. You cannot assign a complaint until at least one worker exists."
          action={
            <Button onClick={openCreate}>
              <Plus />
              Add the first worker
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {active.map((worker) => (
              <WorkerCard
                key={worker.id}
                worker={worker}
                onEdit={() => openEdit(worker)}
                onToggle={() => void toggleActive(worker)}
              />
            ))}
          </div>

          {inactive.length > 0 && (
            <section>
              <h2 className="mb-3 mt-6 font-display text-lg font-bold text-muted-foreground">
                Inactive
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {inactive.map((worker) => (
                  <WorkerCard
                    key={worker.id}
                    worker={worker}
                    onEdit={() => openEdit(worker)}
                    onToggle={() => void toggleActive(worker)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ---------- Create / edit dialog ---------- */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit worker" : "Add a worker"}</DialogTitle>
            <DialogDescription>
              Workers are records, not accounts — they do not sign in. Staff assign complaints to
              them and record the outcome.
            </DialogDescription>
          </DialogHeader>

          {error && <Alert tone="danger">{error}</Alert>}

          <Field label="Name" htmlFor="worker-name" error={fields.name} required>
            <Input
              id="worker-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ashraf Ali"
            />
          </Field>

          <Field
            label="Phone"
            htmlFor="worker-phone"
            hint="So staff can call them directly. Never shown to students."
            error={fields.phone}
          >
            <Input
              id="worker-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="0300-1234567"
            />
          </Field>

          <Field label="Trade" htmlFor="worker-trade" error={fields.trade} required>
            <Select
              value={form.trade}
              onValueChange={(v) => setForm((f) => ({ ...f, trade: v as Trade }))}
            >
              <SelectTrigger id="worker-trade">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRADES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TRADE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">
              Hostels they serve
              <span className="ml-0.5 text-destructive">*</span>
            </legend>
            <div className="space-y-2">
              {allowedHostels.map((hostel) => (
                <label key={hostel} className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <Checkbox
                    checked={form.hostels.includes(hostel)}
                    onCheckedChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        hostels:
                          v === true
                            ? [...f.hostels, hostel]
                            : f.hostels.filter((h) => h !== hostel),
                      }))
                    }
                  />
                  {HOSTEL_META[hostel].label}
                </label>
              ))}
            </div>
            {fields.hostels && (
              <p className="mt-1 text-xs font-medium text-destructive">{fields.hostels}</p>
            )}
          </fieldset>

          <Field label="Notes" htmlFor="worker-notes" hint="Optional — availability, skills, etc.">
            <Textarea
              id="worker-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </Field>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              disabled={busy || form.name.trim().length < 3 || form.hostels.length === 0}
              onClick={() => void submit()}
            >
              {busy ? "Saving…" : editing ? "Save changes" : "Add worker"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={Boolean(confirmOff)}
        onOpenChange={(next) => !next && setConfirmOff(null)}
        title={`Deactivate ${confirmOff?.name ?? ""}?`}
        description="They will no longer appear when assigning a complaint. Their past jobs stay on record, and you can reactivate them at any time."
        confirmLabel="Deactivate"
        destructive
        onConfirm={async () => {
          if (confirmOff) await applyActive(confirmOff);
        }}
      />
    </div>
  );
}

function WorkerCard({
  worker,
  onEdit,
  onToggle,
}: {
  worker: SerializedWorker;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const s = worker.stats;

  return (
    <Card className={cn(!worker.isActive && "opacity-65")}>
      <CardContent className="space-y-3 p-4 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight">{worker.name}</p>
            <p className="text-xs text-muted-foreground">{worker.tradeLabel}</p>
          </div>
          {!worker.isActive && <Badge tone="neutral">Inactive</Badge>}
        </div>

        {worker.phone && (
          <a
            href={`tel:${worker.phone}`}
            className="flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <Phone className="size-3.5" />
            {worker.phone}
          </a>
        )}

        <div className="flex flex-wrap gap-1">
          {worker.hostels.map((h) => (
            <Badge key={h} tone="outline" size="sm">
              {HOSTEL_META[h].short}
            </Badge>
          ))}
        </div>

        <dl className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-2.5 text-center">
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Jobs</dt>
            <dd className="font-display text-base font-bold tabular-nums">{s.assigned}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">On time</dt>
            <dd
              className={cn(
                "font-display text-base font-bold tabular-nums",
                s.completed > 0 && s.onTimeRate < 60 && "text-destructive",
                s.completed > 0 && s.onTimeRate >= 85 && "text-success",
              )}
            >
              {s.completed ? `${s.onTimeRate}%` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Reopened</dt>
            <dd
              className={cn(
                "font-display text-base font-bold tabular-nums",
                s.reopenRate > 20 && "text-destructive",
              )}
            >
              {s.completed ? `${s.reopenRate}%` : "—"}
            </dd>
          </div>
        </dl>

        {s.open > 0 && (
          <p className="text-xs text-muted-foreground">
            {s.open} job{s.open === 1 ? "" : "s"} currently open
            {s.avgTatHours ? ` · avg turnaround ${s.avgTatHours} h` : ""}
          </p>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onEdit} className="flex-1">
            Edit
          </Button>
          <Button
            variant={worker.isActive ? "ghost" : "outline"}
            size="sm"
            onClick={onToggle}
            aria-label={worker.isActive ? "Deactivate" : "Reactivate"}
          >
            {worker.isActive ? <UserX /> : <RotateCcw />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
