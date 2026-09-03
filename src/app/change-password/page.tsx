"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input } from "@/components/ui/primitives";
import { api, errorFields, errorMessage } from "@/lib/apiClient";
import { checkPasswordStrength } from "@/lib/auth/password";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const strength = form.newPassword ? checkPasswordStrength(form.newPassword) : null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setFields({});
    try {
      const data = await api.post<{ redirectTo: string }>("/api/auth/change-password", form);
      toast.success("Password updated.");
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
      title="Change your password"
      subtitle="Staff accounts are created with a temporary password. Choose your own before continuing."
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}

        <Field
          label="Current password"
          htmlFor="currentPassword"
          error={fields.currentPassword}
          required
        >
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            value={form.currentPassword}
            onChange={(e) => set("currentPassword", e.target.value)}
            aria-invalid={Boolean(fields.currentPassword)}
          />
        </Field>

        <Field
          label="New password"
          htmlFor="newPassword"
          hint="At least 8 characters, with one letter and one number"
          error={fields.newPassword || (strength && !strength.ok ? strength.message : "")}
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
    </AuthShell>
  );
}
