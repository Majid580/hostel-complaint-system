"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Megaphone, Pin, Plus } from "lucide-react";
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
import { HOSTEL_META, type Hostel } from "@/lib/domain/constants";
import { formatDateTime, relativeTime } from "@/lib/utils";

type NoticeRow = {
  id: string;
  title: string;
  body: string;
  hostels: Hostel[];
  audience: "ALL" | "STUDENTS" | "STAFF";
  tone: "info" | "warning" | "danger" | "success";
  pinned: boolean;
  startsAt: string;
  endsAt: string | null;
  createdByName: string;
  createdAt: string;
};

export function AnnouncementsManager({
  announcements,
  allowedHostels,
}: {
  announcements: NoticeRow[];
  allowedHostels: Hostel[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    hostels: allowedHostels,
    audience: "ALL" as NoticeRow["audience"],
    tone: "info" as NoticeRow["tone"],
    pinned: false,
    endsAt: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  const submit = async () => {
    setBusy(true);
    setError("");
    setFields({});
    try {
      await api.post("/api/announcements", {
        ...form,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
      });
      toast.success("Notice published.");
      setOpen(false);
      setForm((f) => ({ ...f, title: "", body: "", pinned: false, endsAt: "" }));
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setFields(errorFields(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Notices</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground text-pretty">
            Get ahead of a wave of duplicate complaints. A notice about planned maintenance saves
            fifty separate tickets about the same thing.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus />
          Post a notice
        </Button>
      </header>

      {announcements.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="size-6" />}
          title="No notices yet"
          description="Post one when water or power will be interrupted, when the mess timings change, or when a repair is already scheduled."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus />
              Post the first notice
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {announcements.map((notice) => {
            const expired = notice.endsAt && new Date(notice.endsAt) < new Date();
            return (
              <Card key={notice.id} className={expired ? "opacity-60" : undefined}>
                <CardContent className="p-5 pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="font-semibold leading-tight">{notice.title}</h2>
                    <div className="flex flex-wrap gap-1.5">
                      {notice.pinned && (
                        <Badge tone="primary">
                          <Pin className="size-3" />
                          Pinned
                        </Badge>
                      )}
                      <Badge
                        tone={
                          notice.tone === "danger"
                            ? "danger"
                            : notice.tone === "warning"
                              ? "warning"
                              : notice.tone === "success"
                                ? "success"
                                : "info"
                        }
                      >
                        {notice.tone}
                      </Badge>
                      {expired && <Badge tone="neutral">Expired</Badge>}
                    </div>
                  </div>

                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{notice.body}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {notice.hostels.map((h) => (
                      <Badge key={h} tone="outline" size="sm">
                        {HOSTEL_META[h].short}
                      </Badge>
                    ))}
                    <Badge tone="neutral" size="sm">
                      {notice.audience === "ALL"
                        ? "Everyone"
                        : notice.audience === "STUDENTS"
                          ? "Students"
                          : "Staff"}
                    </Badge>
                  </div>

                  <p className="mt-2.5 text-xs text-muted-foreground">
                    {notice.createdByName} · {relativeTime(notice.createdAt)}
                    {notice.endsAt ? ` · ends ${formatDateTime(notice.endsAt)}` : ""}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ---------- Composer ---------- */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Post a notice</DialogTitle>
            <DialogDescription>
              It appears on the residents&apos; dashboard and in their notification bell.
            </DialogDescription>
          </DialogHeader>

          {error && <Alert tone="danger">{error}</Alert>}

          <Field label="Title" htmlFor="notice-title" error={fields.title} required>
            <Input
              id="notice-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Water supply maintenance on Sunday"
            />
          </Field>

          <Field label="Message" htmlFor="notice-body" error={fields.body} required>
            <Textarea
              id="notice-body"
              rows={4}
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="The main tank will be cleaned this Sunday between 9 am and 1 pm. Water will be off in all three hostels during that window. Please store water in advance — you do not need to file a complaint about this."
            />
          </Field>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Hostels</legend>
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
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Audience" htmlFor="notice-audience">
              <Select
                value={form.audience}
                onValueChange={(v) => setForm((f) => ({ ...f, audience: v as NoticeRow["audience"] }))}
              >
                <SelectTrigger id="notice-audience">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Everyone</SelectItem>
                  <SelectItem value="STUDENTS">Students only</SelectItem>
                  <SelectItem value="STAFF">Staff only</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Importance" htmlFor="notice-tone">
              <Select
                value={form.tone}
                onValueChange={(v) => setForm((f) => ({ ...f, tone: v as NoticeRow["tone"] }))}
              >
                <SelectTrigger id="notice-tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Information</SelectItem>
                  <SelectItem value="success">Good news</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="danger">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field
            label="Show until"
            htmlFor="notice-ends"
            hint="Optional — leave blank to keep it visible indefinitely."
          >
            <Input
              id="notice-ends"
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
            />
          </Field>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <Checkbox
              checked={form.pinned}
              onCheckedChange={(v) => setForm((f) => ({ ...f, pinned: v === true }))}
            />
            Pin to the top
          </label>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              disabled={
                busy ||
                form.title.trim().length < 4 ||
                form.body.trim().length < 10 ||
                form.hostels.length === 0
              }
              onClick={() => void submit()}
            >
              {busy ? "Publishing…" : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
