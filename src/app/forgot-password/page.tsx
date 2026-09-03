"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input } from "@/components/ui/primitives";
import { api, errorFields, errorMessage } from "@/lib/apiClient";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setFields({});
    try {
      await api.post("/api/auth/forgot-password", { email });
      setSent(true);
      setTimeout(() => router.push(`/reset-password?email=${encodeURIComponent(email)}`), 1200);
    } catch (caught) {
      setError(errorMessage(caught));
      setFields(errorFields(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter the e-mail on your account and we will send you a 6-digit code."
      footer={
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <Alert tone="success" title="Check your inbox">
          If that e-mail is registered, a 6-digit code is on its way. Taking you to the next step…
        </Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="E-mail" htmlFor="email" error={fields.email} required>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(fields.email)}
              placeholder="you@example.edu"
            />
          </Field>
          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            <Mail />
            {busy ? "Sending…" : "Send the code"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
