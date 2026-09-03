"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import * as Icons from "lucide-react";
import { Info, Send, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Alert,
  Badge,
  Card,
  CardContent,
  Checkbox,
  Field,
  Input,
  Textarea,
} from "@/components/ui/primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";
import { ImageUploader } from "@/components/media/ImageUploader";
import { AudioRecorder } from "@/components/media/AudioRecorder";
import type { UploadedAttachment } from "@/components/media/useUpload";
import { api, errorFields, errorMessage } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import {
  CATEGORIES,
  CATEGORY_META,
  HOSTEL_OPTIONS,
  SEVERITIES,
  SEVERITY_META,
  type Category,
  type Hostel,
  type Severity,
} from "@/lib/domain/constants";

type IconName = keyof typeof Icons;

export function NewComplaintForm({
  defaultHostel,
  regNo,
  limits,
  allowAnonymous,
}: {
  defaultHostel: Hostel;
  regNo: string;
  limits: { maxImages: number; maxImageMb: number; maxAudioMb: number; maxAudioSeconds: number };
  allowAnonymous: boolean;
}) {
  const router = useRouter();

  const [hostel, setHostel] = useState<Hostel>(defaultHostel);
  const [category, setCategory] = useState<Category | "">("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [roomNo, setRoomNo] = useState("");
  const [severity, setSeverity] = useState<Severity | "">("");
  const [severityTouched, setSeverityTouched] = useState(false);
  const [images, setImages] = useState<UploadedAttachment[]>([]);
  const [audio, setAudio] = useState<UploadedAttachment | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  const meta = category ? CATEGORY_META[category] : null;

  // Picking a category suggests a severity — the student can override it.
  const effectiveSeverity: Severity | "" =
    severityTouched || !meta ? severity : (meta.defaultSeverity as Severity);

  const sla = effectiveSeverity ? SEVERITY_META[effectiveSeverity] : null;

  const canSubmit = useMemo(
    () =>
      Boolean(
        category &&
          effectiveSeverity &&
          title.trim().length >= 5 &&
          description.trim().length >= 10,
      ),
    [category, effectiveSeverity, title, description],
  );

  const chooseCategory = (next: Category) => {
    setCategory(next);
    if (!severityTouched) setSeverity(CATEGORY_META[next].defaultSeverity as Severity);
    if (!title.trim()) setTitle("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setError("");
    setFields({});

    try {
      const data = await api.post<{ code: string; redirectTo: string }>("/api/complaints", {
        hostel,
        category,
        title: title.trim(),
        description: description.trim(),
        location: location.trim() || undefined,
        roomNo: roomNo.trim() || undefined,
        severity: effectiveSeverity,
        images,
        audio,
        isAnonymous,
      });

      toast.success(`Complaint ${data.code} filed`, {
        description: "Your Resident Tutor and the Hostel Warden have been notified.",
      });
      router.push(data.redirectTo);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setFields(errorFields(caught));
      setBusy(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">File a complaint</h1>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          It goes straight to your hostel&apos;s Resident Tutor and to the Hostel Warden. You will
          be able to follow every step.
        </p>
      </header>

      {error && (
        <Alert tone="danger" icon={<TriangleAlert className="size-4" />} title="Could not file this complaint">
          {error}
        </Alert>
      )}

      <form onSubmit={submit} className="space-y-6" noValidate>
        {/* ---------- 1. What kind of problem ---------- */}
        <Card>
          <CardContent className="space-y-4 p-5 pt-5">
            <div>
              <h2 className="font-semibold">1 · What kind of problem is it?</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                This decides who gets assigned and how urgently it is treated.
              </p>
            </div>

            <fieldset>
              <legend className="sr-only">Complaint category</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CATEGORIES.map((key) => {
                  const info = CATEGORY_META[key];
                  const Icon = (Icons[info.icon as IconName] ??
                    Icons.CircleHelp) as React.ComponentType<{ className?: string }>;
                  const active = category === key;
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => chooseCategory(key)}
                      aria-pressed={active}
                      className={cn(
                        "flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-colors",
                        active
                          ? "border-primary bg-primary/8 ring-1 ring-primary"
                          : "border-border bg-card hover:border-primary/40 hover:bg-accent",
                      )}
                    >
                      <Icon className={cn("size-5", active ? "text-primary" : "text-muted-foreground")} />
                      <span className="text-sm font-medium leading-tight">{info.label}</span>
                      {info.isSafety && (
                        <Badge tone="danger" size="sm">
                          Safety
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {fields.category && <p className="text-xs font-medium text-destructive">{fields.category}</p>}

            {meta && (
              <Alert tone="info" icon={<Info className="size-4" />}>
                <span className="font-medium text-foreground">Common examples: </span>
                {meta.examples}
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* ---------- 2. Describe it ---------- */}
        <Card>
          <CardContent className="space-y-4 p-5 pt-5">
            <div>
              <h2 className="font-semibold">2 · Describe the problem</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Be specific. What is broken, since when, and how it affects you.
              </p>
            </div>

            <Field label="Short title" htmlFor="title" error={fields.title} required>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={160}
                required
                placeholder="No electricity in room since last night"
                aria-invalid={Boolean(fields.title)}
              />
            </Field>

            <Field
              label="What exactly is wrong?"
              htmlFor="description"
              hint={`${description.length}/3000 characters`}
              error={fields.description}
              required
            >
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 3000))}
                rows={5}
                required
                placeholder="The power in my room has been out since about 11 pm yesterday. The main switch trips as soon as we turn it back on, and there is a burning smell near the socket beside the study table."
                aria-invalid={Boolean(fields.description)}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Where is it?"
                htmlFor="location"
                hint="Block, floor, room, washroom…"
                error={fields.location}
              >
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Second floor common washroom"
                />
              </Field>

              <Field
                label="Your room number"
                htmlFor="roomNo"
                hint="Helps the worker find the right door"
                error={fields.roomNo}
              >
                <Input
                  id="roomNo"
                  value={roomNo}
                  onChange={(e) => setRoomNo(e.target.value)}
                  placeholder="F-214"
                />
              </Field>
            </div>

            <Field
              label="Hostel"
              htmlFor="hostel"
              hint={`You are registered as ${regNo}. Complaints can only be filed for the hostel you live in.`}
              error={fields.hostel}
              required
            >
              <Select value={hostel} onValueChange={(v) => setHostel(v as Hostel)}>
                <SelectTrigger id="hostel" aria-invalid={Boolean(fields.hostel)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOSTEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </CardContent>
        </Card>

        {/* ---------- 3. Evidence ---------- */}
        <Card>
          <CardContent className="space-y-5 p-5 pt-5">
            <div>
              <h2 className="font-semibold">3 · Show it (optional, but it helps a lot)</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Photos and a voice note make it far more likely the right person turns up with the
                right tools the first time.
              </p>
            </div>

            <ImageUploader
              value={images}
              onChange={setImages}
              max={limits.maxImages}
              hint={`Up to ${limits.maxImages} photos, ${limits.maxImageMb} MB each.`}
            />

            <AudioRecorder value={audio} onChange={setAudio} maxSeconds={limits.maxAudioSeconds} />
          </CardContent>
        </Card>

        {/* ---------- 4. Urgency ---------- */}
        <Card>
          <CardContent className="space-y-4 p-5 pt-5">
            <div>
              <h2 className="font-semibold">4 · How urgent is it?</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Be honest — staff can adjust this, and repeatedly overstating urgency is visible on
                your record.
              </p>
            </div>

            <fieldset>
              <legend className="sr-only">Severity</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {SEVERITIES.map((key) => {
                  const info = SEVERITY_META[key];
                  const active = effectiveSeverity === key;
                  const suggested = meta?.defaultSeverity === key;
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => {
                        setSeverity(key);
                        setSeverityTouched(true);
                      }}
                      aria-pressed={active}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-colors",
                        active
                          ? "border-primary bg-primary/8 ring-1 ring-primary"
                          : "border-border bg-card hover:border-primary/40 hover:bg-accent",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{info.label}</span>
                        {suggested && !severityTouched && (
                          <Badge tone="primary" size="sm">
                            Suggested
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{info.hint}</p>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {sla && (
              <Alert tone="neutral">
                At this level staff must acknowledge within{" "}
                <strong className="text-foreground">{sla.ackHours} hours</strong> and resolve within{" "}
                <strong className="text-foreground">{sla.resolveHours} hours</strong>. If nothing
                happens for 24 hours you can escalate it to the Hostel Warden yourself.
              </Alert>
            )}

            {allowAnonymous && (
              <label className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <Checkbox
                  checked={isAnonymous}
                  onCheckedChange={(v) => setIsAnonymous(v === true)}
                  className="mt-0.5"
                />
                <span className="leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">Hide my name from other students.</span>{" "}
                  The Resident Tutor, Warden and Coordinator will still see who filed it — that is
                  what keeps the system accountable — but other residents will not.
                </span>
              </label>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => router.back()} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={!canSubmit || busy}>
            <Send />
            {busy ? "Filing…" : "File the complaint"}
          </Button>
        </div>

        {!canSubmit && (
          <p className="text-right text-xs text-muted-foreground">
            Choose a category, add a title of at least 5 characters and a description of at least 10.
          </p>
        )}
      </form>
    </div>
  );
}
