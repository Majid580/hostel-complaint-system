"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TriangleAlert, UserPlus } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Alert, Checkbox, Field, Input } from "@/components/ui/primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";
import { api, errorFields, errorMessage } from "@/lib/apiClient";
import { useFieldErrors } from "@/lib/hooks/useFieldErrors";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { HOSTEL_OPTIONS, type Hostel } from "@/lib/domain/constants";
import { REG_NO_EXAMPLE, explainRegNoError, isValidRegNo } from "@/lib/domain/regNo";
import { DEFAULT_SETTINGS } from "@/lib/domain/constants";
import { checkPasswordStrength } from "@/lib/auth/password";

/** Visual order, top to bottom. */
const FIELD_ORDER = [
  "name", "regNo", "email", "phone", "hostel", "roomNo",
  "password", "confirmPassword", "acceptTerms",
] as const;
const FIELD_LABEL: Record<string, string> = {
  name: "Full name",
  regNo: "Registration number",
  email: "E-mail",
  phone: "Phone",
  hostel: "Your hostel",
  roomNo: "Room number",
  password: "Password",
  confirmPassword: "Confirm password",
  acceptTerms: "Usage policy",
};

export default function RegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    regNo: "",
    email: "",
    phone: "",
    hostel: "" as Hostel | "",
    roomNo: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const { fields, setFields, jumpTo, showProblems, checkField, clearField } =
    useFieldErrors(FIELD_ORDER);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    // An error that is being actively corrected should stop shouting.
    clearField(key as string);
  };

  const regNoTouched = form.regNo.length > 3;
  const regNoError = regNoTouched && !isValidRegNo(form.regNo) ? explainRegNoError(form.regNo) : "";
  const strength = form.password ? checkPasswordStrength(form.password) : null;

  /**
   * Mirrors registerSchema on the server. The server stays the authority; this
   * exists so a student is told what to fix straight away rather than after a
   * round trip — registration is most people's first contact with the system.
   */
  const validate = (): Record<string, string> => {
    const p: Record<string, string> = {};

    if (!form.name.trim()) p.name = "Enter your full name.";
    else if (form.name.trim().length < 3) p.name = "That looks too short to be a full name.";

    if (!form.regNo.trim()) p.regNo = "Enter your registration number.";
    else if (!isValidRegNo(form.regNo)) p.regNo = explainRegNoError(form.regNo);

    if (!form.email.trim()) p.email = "Enter your e-mail address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim()))
      p.email = "That does not look like a valid e-mail address.";

    if (!form.hostel) p.hostel = "Choose the hostel you live in.";

    if (!form.password) p.password = "Choose a password.";
    else {
      const check = checkPasswordStrength(form.password);
      if (!check.ok) p.password = check.message ?? "That password is too weak.";
    }

    if (!form.confirmPassword) p.confirmPassword = "Type your password a second time.";
    else if (form.password !== form.confirmPassword)
      p.confirmPassword = "These two passwords do not match.";

    if (!form.acceptTerms) p.acceptTerms = "You need to accept the usage policy to continue.";

    return p;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    const problems = validate();
    if (Object.keys(problems).length > 0) {
      setError("");
      showProblems(problems);
      return;
    }

    setBusy(true);
    setError("");
    setFields({});

    try {
      const data = await api.post<{ redirectTo: string }>("/api/auth/register", {
        ...form,
        phone: form.phone || undefined,
        roomNo: form.roomNo || undefined,
      });
      router.push(data.redirectTo);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setFields(errorFields(caught));
      setBusy(false);
    }
  };

  return (
    <AuthShell
      wide
      title="Create your student account"
      subtitle="You only need to do this once. After that, filing a complaint takes under a minute."
      footer={
        <>
          Already registered?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}

        <ErrorSummary fields={fields} order={FIELD_ORDER} labels={FIELD_LABEL} onJump={jumpTo} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="name" error={fields.name} required>
            <Input
              id="name"
              onBlur={() => checkField("name", validate())}
              autoComplete="name"
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              aria-invalid={Boolean(fields.name)}
              placeholder="Ayesha Khan"
            />
          </Field>

          <Field
            label="Registration number"
            htmlFor="regNo"
            hint={`Session-department-roll, e.g. ${REG_NO_EXAMPLE}. Departments: ${DEFAULT_SETTINGS.departments.join(", ")}.`}
            error={fields.regNo || regNoError}
            required
          >
            <Input
              id="regNo"
              required
              value={form.regNo}
              onChange={(e) => set("regNo", e.target.value.toUpperCase())}
              aria-invalid={Boolean(fields.regNo || regNoError)}
              placeholder={REG_NO_EXAMPLE}
              className="font-mono"
              autoCapitalize="characters"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="E-mail" htmlFor="email" error={fields.email} required>
            <Input
              id="email"
              onBlur={() => checkField("email", validate())}
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              aria-invalid={Boolean(fields.email)}
              placeholder="you@example.edu"
            />
          </Field>

          <Field
            label="Phone"
            htmlFor="phone"
            hint="Optional — helps staff reach you about a repair visit"
            error={fields.phone}
          >
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="0300-1234567"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your hostel" htmlFor="hostel" error={fields.hostel} required>
            <Select value={form.hostel} onValueChange={(v) => set("hostel", v as Hostel)}>
              <SelectTrigger id="hostel" aria-invalid={Boolean(fields.hostel)}>
                <SelectValue placeholder="Select your hostel" />
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

          <Field
            label="Room number"
            htmlFor="roomNo"
            hint="Optional, but it gets the worker to the right door"
            error={fields.roomNo}
          >
            <Input
              id="roomNo"
              value={form.roomNo}
              onChange={(e) => set("roomNo", e.target.value)}
              placeholder="F-214"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Password"
            htmlFor="password"
            hint="At least 8 characters, with one letter and one number"
            error={fields.password || (strength && !strength.ok ? strength.message : "")}
            required
          >
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              aria-invalid={Boolean(fields.password)}
            />
            {form.password && (
              <div className="mt-1.5 flex gap-1" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`h-1 flex-1 rounded-full ${
                      strength && i < strength.score
                        ? strength.score >= 3
                          ? "bg-success"
                          : "bg-warning"
                        : "bg-muted"
                    }`}
                  />
                ))}
              </div>
            )}
          </Field>

          <Field
            label="Confirm password"
            htmlFor="confirmPassword"
            error={
              fields.confirmPassword ||
              (form.confirmPassword && form.confirmPassword !== form.password
                ? "Passwords do not match."
                : "")
            }
            required
          >
            <Input
              id="confirmPassword"
              onBlur={() => checkField("confirmPassword", validate())}
              type="password"
              autoComplete="new-password"
              required
              value={form.confirmPassword}
              onChange={(e) => set("confirmPassword", e.target.value)}
              aria-invalid={Boolean(fields.confirmPassword)}
            />
          </Field>
        </div>

        <label className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <Checkbox
            checked={form.acceptTerms}
            onCheckedChange={(v) => set("acceptTerms", v === true)}
            className="mt-0.5"
            aria-describedby="terms-text"
          />
          <span id="terms-text" className="leading-relaxed text-muted-foreground">
            I will use this system honestly, and I understand that complaints and escalations are
            recorded against my registration number. Misuse can be referred to the hostel
            administration.
          </span>
        </label>
        {fields.acceptTerms && (
          <p role="alert" className="flex items-center gap-1.5 text-xs font-medium text-destructive">
            <TriangleAlert className="size-3.5 shrink-0" />
            {fields.acceptTerms}
          </p>
        )}

        <Button type="submit" className="w-full" size="lg" disabled={busy}>
          <UserPlus />
          {busy ? "Creating your account…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
