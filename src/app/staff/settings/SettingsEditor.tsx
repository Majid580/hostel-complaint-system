"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Info, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Alert,
  Card,
  CardContent,
  Field,
  Input,
  Switch,
} from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/apiClient";
import { SEVERITIES, SEVERITY_META, type SettingsShape } from "@/lib/domain/constants";

export function SettingsEditor({ initial }: { initial: SettingsShape }) {
  const router = useRouter();
  const [sla, setSla] = useState(initial.sla);
  const [escalation, setEscalation] = useState(initial.escalation);
  const [policy, setPolicy] = useState(initial.policy);
  // Edited as free text so codes can be typed naturally; split on save.
  const [departments, setDepartments] = useState(initial.departments.join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const parsedDepartments = departments
        .split(/[,\s]+/)
        .map((d) => d.trim().toUpperCase())
        .filter(Boolean);

      if (parsedDepartments.length === 0) {
        setError("Enter at least one department code — students cannot register without one.");
        setBusy(false);
        return;
      }
      const tooLong = parsedDepartments.find((d) => d.length < 2 || d.length > 5);
      if (tooLong) {
        setError(`"${tooLong}" is not a valid department code. Use 2 to 5 letters.`);
        setBusy(false);
        return;
      }

      await api.patch("/api/settings", {
        sla,
        escalation,
        policy,
        departments: parsedDepartments,
      });
      toast.success("Settings saved. New complaints use the updated rules immediately.");
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-bold">System settings</h1>
        <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground text-pretty">
          These rules govern how quickly staff must respond and when students can escalate. Every
          change is recorded in the system log with your name.
        </p>
      </header>

      {error && <Alert tone="danger">{error}</Alert>}

      {/* ---------- SLA ---------- */}
      <Card>
        <CardContent className="p-5 pt-5">
          <h2 className="font-semibold">Response deadlines</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            How long staff have to acknowledge and to resolve each severity level. Changing these
            affects new complaints and any complaint whose severity is edited afterwards.
          </p>

          <div className="mt-4 space-y-4">
            {SEVERITIES.map((severity) => (
              <div key={severity} className="grid items-end gap-3 sm:grid-cols-[1fr_auto_auto]">
                <div>
                  <p className="text-sm font-medium">{SEVERITY_META[severity].label}</p>
                  <p className="text-xs text-muted-foreground">{SEVERITY_META[severity].hint}</p>
                </div>
                <Field label="Acknowledge (h)" htmlFor={`ack-${severity}`}>
                  <Input
                    id={`ack-${severity}`}
                    type="number"
                    min={1}
                    max={720}
                    className="w-28"
                    value={sla[severity].ackHours}
                    onChange={(e) =>
                      setSla((s) => ({
                        ...s,
                        [severity]: { ...s[severity], ackHours: Number(e.target.value) },
                      }))
                    }
                  />
                </Field>
                <Field label="Resolve (h)" htmlFor={`res-${severity}`}>
                  <Input
                    id={`res-${severity}`}
                    type="number"
                    min={1}
                    max={2160}
                    className="w-28"
                    value={sla[severity].resolveHours}
                    onChange={(e) =>
                      setSla((s) => ({
                        ...s,
                        [severity]: { ...s[severity], resolveHours: Number(e.target.value) },
                      }))
                    }
                  />
                </Field>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ---------- Escalation ---------- */}
      <Card>
        <CardContent className="p-5 pt-5">
          <h2 className="font-semibold">Escalation windows</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            The rules that stop complaints quietly disappearing.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <NumberField
              label="Student can escalate after (hours)"
              hint="How long a complaint may sit untouched before the student gets an Escalate to Warden button."
              value={escalation.studentEscalateAfterHours}
              onChange={(v) =>
                setEscalation((e) => ({ ...e, studentEscalateAfterHours: v }))
              }
            />
            <NumberField
              label="Can report a false resolution after (hours)"
              hint="How long after a complaint is marked resolved before the student may report that the work was never done."
              value={escalation.falseResolutionFlagAfterHours}
              onChange={(v) =>
                setEscalation((e) => ({ ...e, falseResolutionFlagAfterHours: v }))
              }
            />
            <NumberField
              label="Auto-escalate stale complaints after (hours)"
              hint="The scheduled sweep escalates a complaint with no activity for this long, even if the student does nothing."
              value={escalation.autoEscalateStaleAfterHours}
              onChange={(v) => setEscalation((e) => ({ ...e, autoEscalateStaleAfterHours: v }))}
            />
            <NumberField
              label="Escalate to the Coordinator after a further (hours)"
              hint="A complaint still open this long after reaching the Warden goes to the Campus Coordinator."
              value={escalation.level2AfterHours}
              onChange={(v) => setEscalation((e) => ({ ...e, level2AfterHours: v }))}
            />
            <NumberField
              label="Auto-close resolved complaints after (hours)"
              hint="If the student never responds to a resolution, the complaint closes on its own after this long."
              value={escalation.autoCloseResolvedAfterHours}
              onChange={(v) => setEscalation((e) => ({ ...e, autoCloseResolvedAfterHours: v }))}
            />
            <NumberField
              label="Escalation cooldown (hours)"
              hint="Minimum gap between two escalations of the same complaint, so the Warden inbox is not flooded."
              value={escalation.escalationCooldownHours}
              onChange={(v) => setEscalation((e) => ({ ...e, escalationCooldownHours: v }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* ---------- Policy ---------- */}
      <Card>
        <CardContent className="p-5 pt-5">
          <h2 className="font-semibold">Policy</h2>

          <div className="mt-4 space-y-4">
            <ToggleRow
              label="Require a proof photo before a complaint can be marked resolved"
              hint="Strongly recommended. This is the single most effective control against complaints being closed without the work being done."
              checked={policy.requireProofOnResolve}
              onChange={(v) => setPolicy((p) => ({ ...p, requireProofOnResolve: v }))}
            />
            <ToggleRow
              label="Allow students to hide their name from other students"
              hint="Staff always see who filed a complaint — anonymity only applies between residents."
              checked={policy.allowAnonymous}
              onChange={(v) => setPolicy((p) => ({ ...p, allowAnonymous: v }))}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="Max complaints per student per day"
                hint="Spam control. Genuine cases rarely exceed a handful."
                value={policy.maxComplaintsPerStudentPerDay}
                onChange={(v) => setPolicy((p) => ({ ...p, maxComplaintsPerStudentPerDay: v }))}
              />
              <Field
                label="Restrict registration to this e-mail domain"
                htmlFor="domain"
                hint="Leave blank to accept any e-mail address. Example: student.uet.edu.pk"
              >
                <Input
                  id="domain"
                  value={policy.allowedEmailDomain}
                  onChange={(e) =>
                    setPolicy((p) => ({ ...p, allowedEmailDomain: e.target.value.trim() }))
                  }
                  placeholder="student.example.edu"
                />
              </Field>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---------- Departments ---------- */}
      <Card>
        <CardContent className="p-5 pt-5">
          <h2 className="font-semibold">Departments</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            The department codes this institute issues. A student whose registration
            number uses anything else cannot sign up, so add a code here the day a new
            programme opens.
          </p>

          <Field
            label="Department codes"
            htmlFor="departments"
            hint="Separate with commas. 2 to 5 letters each — for example CS, BSCPE, EE."
            className="mt-4"
          >
            <Input
              id="departments"
              value={departments}
              onChange={(e) => setDepartments(e.target.value)}
              placeholder="CS, BSCPE, EE, ARCH, CE, ME, BME"
              autoCapitalize="characters"
              spellCheck={false}
            />
          </Field>

          <p className="mt-3 text-xs text-muted-foreground">
            A registration number is read as{" "}
            <span className="font-mono">session-department-roll</span>, so{" "}
            <span className="font-mono">2023-CS-580</span> is a 2023 Computer Science
            student with roll number 580.
          </p>
        </CardContent>
      </Card>

      <Alert tone="info" icon={<Info className="size-4" />}>
        Escalation windows are enforced by the scheduled sweep, which runs every 15 minutes via a
        free GitHub Actions workflow. If the sweep stops running, students can still escalate
        manually but nothing escalates automatically.
      </Alert>

      <div className="flex justify-end">
        <Button size="lg" onClick={() => void save()} disabled={busy}>
          <Save />
          {busy ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}

function NumberField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <Input
        id={id}
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
