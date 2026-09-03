"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input } from "@/components/ui/primitives";
import { api, errorFields, errorMessage } from "@/lib/apiClient";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [form, setForm] = useState({
    email: params.get("email") ?? "",
    code: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setFields({});
    try {
      await api.post("/api/auth/reset-password", form);
      setDone(true);
      setTimeout(() => router.push("/login"), 1500);
    } catch (caught) {
      setError(errorMessage(caught));
      setFields(errorFields(caught));
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Enter the 6-digit code we e-mailed you, then choose a new password."
      footer={
        <Link href="/forgot-password" className="font-medium text-primary hover:underline">
          Send a new code
        </Link>
      }
    >
      {done ? (
        <Alert tone="success" title="Password updated">
          You can sign in with your new password. Taking you to the sign-in page…
        </Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && <Alert tone="danger">{error}</Alert>}

          <Field label="E-mail" htmlFor="email" error={fields.email} required>
            <Input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              aria-invalid={Boolean(fields.email)}
            />
          </Field>

          <Field label="6-digit code" htmlFor="code" error={fields.code} required>
            <Input
              id="code"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              value={form.code}
              onChange={(e) => set("code", e.target.value.replace(/\D/g, ""))}
              aria-invalid={Boolean(fields.code)}
              className="text-center font-mono text-xl tracking-[0.5em]"
              placeholder="000000"
            />
          </Field>

          <Field
            label="New password"
            htmlFor="newPassword"
            hint="At least 8 characters, with one letter and one number"
            error={fields.newPassword}
            required
          >
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              required
              value={form.newPassword}
              onChange={(e) => set("newPassword", e.target.value)}
              aria-invalid={Boolean(fields.newPassword)}
            />
          </Field>

          <Field
            label="Confirm new password"
            htmlFor="confirmPassword"
            error={fields.confirmPassword}
            required
          >
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={form.confirmPassword}
              onChange={(e) => set("confirmPassword", e.target.value)}
              aria-invalid={Boolean(fields.confirmPassword)}
            />
          </Field>

          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            <KeyRound />
            {busy ? "Updating…" : "Update password"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthShell title="Set a new password">{null}</AuthShell>}>
      <ResetForm />
    </Suspense>
  );
}
