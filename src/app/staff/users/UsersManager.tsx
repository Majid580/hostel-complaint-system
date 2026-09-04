"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Plus, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Alert,
  Badge,
  Card,
  CardContent,
  Field,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
import { HOSTEL_META, HOSTEL_OPTIONS, ROLE_META, type Hostel } from "@/lib/domain/constants";
import { relativeTime } from "@/lib/utils";

type StaffRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "RT" | "WARDEN" | "COORDINATOR";
  hostel: Hostel | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
};

export function UsersManager({
  users,
  currentUserId,
  studentCount,
}: {
  users: StaffRow[];
  currentUserId: string;
  studentCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState<{ email: string; password: string } | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "RT" as StaffRow["role"],
    hostel: "" as Hostel | "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  const create = async () => {
    setBusy(true);
    setError("");
    setFields({});
    try {
      const data = await api.post<{ temporaryPassword: string }>("/api/users", {
        ...form,
        phone: form.phone || undefined,
        hostel: form.role === "RT" ? form.hostel : undefined,
      });
      setTempPassword({ email: form.email, password: data.temporaryPassword });
      toast.success("Account created. A welcome e-mail with the temporary password was sent.");
      setOpen(false);
      setForm({ name: "", email: "", phone: "", role: "RT", hostel: "" });
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setFields(errorFields(caught));
    } finally {
      setBusy(false);
    }
  };

  // Reactivating is harmless and stays a single tap. Deactivating ends the
  // person's live sessions immediately, which is not something to fire off a
  // mis-tap on a phone.
  const [confirmOff, setConfirmOff] = useState<StaffRow | null>(null);

  const toggleActive = async (person: StaffRow) => {
    if (person.isActive) {
      setConfirmOff(person);
      return;
    }
    await applyActive(person);
  };

  const applyActive = async (person: StaffRow) => {
    try {
      await api.patch(`/api/users/${person.id}`, { isActive: !person.isActive });
      toast.success(
        person.isActive
          ? `${person.name} deactivated — their sessions have been ended.`
          : `${person.name} reactivated.`,
      );
      router.refresh();
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  };

  const rtByHostel = HOSTEL_OPTIONS.map((option) => ({
    ...option,
    rt: users.find((u) => u.role === "RT" && u.hostel === option.value && u.isActive),
  }));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Staff accounts</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {users.filter((u) => u.isActive).length} active staff · {studentCount} registered
            students
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus />
          Add a staff account
        </Button>
      </header>

      {tempPassword && (
        <Alert tone="success" title="Account created" icon={<KeyRound className="size-4" />}>
          Temporary password for <strong>{tempPassword.email}</strong>:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm font-bold">
            {tempPassword.password}
          </code>
          <span className="mt-1 block text-xs">
            Shown once, in case the e-mail does not arrive. They must change it at first sign-in.
          </span>
        </Alert>
      )}

      {/* ---------- Coverage check ---------- */}
      <div className="grid gap-3 sm:grid-cols-3">
        {rtByHostel.map((row) => (
          <Card key={row.value} className={row.rt ? undefined : "border-destructive/40"}>
            <CardContent className="p-4 pt-4">
              <p className="text-xs text-muted-foreground">{row.label}</p>
              {row.rt ? (
                <>
                  <p className="mt-1 font-semibold leading-tight">{row.rt.name}</p>
                  <p className="text-xs text-muted-foreground">{row.rt.email}</p>
                </>
              ) : (
                <p className="mt-1 text-sm font-medium text-destructive">
                  No active Resident Tutor — complaints from this hostel reach only the Warden.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((person) => (
                <TableRow key={person.id}>
                  <TableCell>
                    <p className="font-medium">{person.name}</p>
                    <p className="text-xs text-muted-foreground">{person.email}</p>
                  </TableCell>
                  <TableCell>
                    <Badge tone={person.role === "COORDINATOR" ? "primary" : "neutral"}>
                      {ROLE_META[person.role].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {person.hostel ? HOSTEL_META[person.hostel].label : "All hostels"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {person.lastLoginAt ? relativeTime(person.lastLoginAt) : "Never"}
                  </TableCell>
                  <TableCell>
                    {person.isActive ? (
                      person.mustChangePassword ? (
                        <Badge tone="warning">Password not set</Badge>
                      ) : (
                        <Badge tone="success">Active</Badge>
                      )
                    ) : (
                      <Badge tone="neutral">Disabled</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {person.id === currentUserId ? (
                      <span className="text-xs text-muted-foreground">You</span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void toggleActive(person)}
                        aria-label={person.isActive ? "Deactivate" : "Reactivate"}
                      >
                        {person.isActive ? <UserX /> : <UserCheck />}
                        {person.isActive ? "Disable" : "Enable"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ---------- Create dialog ---------- */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a staff account</DialogTitle>
            <DialogDescription>
              A temporary password is generated and e-mailed. They must change it the first time
              they sign in.
            </DialogDescription>
          </DialogHeader>

          {error && <Alert tone="danger">{error}</Alert>}

          <Field label="Full name" htmlFor="staff-name" error={fields.name} required>
            <Input
              id="staff-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>

          <Field label="E-mail" htmlFor="staff-email" error={fields.email} required>
            <Input
              id="staff-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="rt.qasim@example.edu"
            />
          </Field>

          <Field label="Phone" htmlFor="staff-phone" error={fields.phone}>
            <Input
              id="staff-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </Field>

          <Field label="Role" htmlFor="staff-role" error={fields.role} required>
            <Select
              value={form.role}
              onValueChange={(v) => setForm((f) => ({ ...f, role: v as StaffRow["role"] }))}
            >
              <SelectTrigger id="staff-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RT">Resident Tutor — one hostel</SelectItem>
                <SelectItem value="WARDEN">Hostel Warden — all hostels</SelectItem>
                <SelectItem value="COORDINATOR">
                  Campus Coordinator — all hostels plus admin
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {form.role === "RT" && (
            <Field label="Hostel" htmlFor="staff-hostel" error={fields.hostel} required>
              <Select
                value={form.hostel}
                onValueChange={(v) => setForm((f) => ({ ...f, hostel: v as Hostel }))}
              >
                <SelectTrigger id="staff-hostel">
                  <SelectValue placeholder="Select the hostel" />
                </SelectTrigger>
                <SelectContent>
                  {HOSTEL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <Alert tone="info" icon={<ShieldCheck className="size-4" />}>
            Only one active Resident Tutor is allowed per hostel, so complaint routing is never
            ambiguous. Disable the current RT before adding a replacement.
          </Alert>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              disabled={
                busy ||
                form.name.trim().length < 3 ||
                !form.email.includes("@") ||
                (form.role === "RT" && !form.hostel)
              }
              onClick={() => void create()}
            >
              {busy ? "Creating…" : "Create account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirmOff)}
        onOpenChange={(next) => !next && setConfirmOff(null)}
        title={`Deactivate ${confirmOff?.name ?? ""}?`}
        description={
          <>
            They will be signed out immediately, on every device, and will not be able to sign in
            again until you reactivate the account.
            {confirmOff?.role === "RT" && confirmOff.hostel && (
              <>
                {" "}
                <strong className="text-foreground">
                  Complaints from that hostel will have no Resident Tutor to route to
                </strong>{" "}
                until you appoint another one.
              </>
            )}
          </>
        }
        confirmLabel="Deactivate"
        destructive
        onConfirm={async () => {
          if (confirmOff) await applyActive(confirmOff);
        }}
      />
    </div>
  );
}
