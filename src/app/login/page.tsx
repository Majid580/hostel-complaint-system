"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input } from "@/components/ui/primitives";
import { api, errorFields, errorMessage } from "@/lib/apiClient";
import { REG_NO_EXAMPLE } from "@/lib/domain/regNo";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setFields({});

    try {
      const data = await api.post<{ redirectTo: string }>("/api/auth/login", {
        identifier,
        password,
      });
      router.push(next && next.startsWith("/") ? next : data.redirectTo);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setFields(errorFields(caught));
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="Students can use their registration number or e-mail. Staff sign in with their e-mail."
      footer={
        <>
          New here?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create a student account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}

        <Field
          label="Registration number or e-mail"
          htmlFor="identifier"
          hint={`For example ${REG_NO_EXAMPLE}`}
          error={fields.identifier}
          required
        >
          <Input
            id="identifier"
            name="identifier"
            autoComplete="username"
            autoCapitalize="characters"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            aria-invalid={Boolean(fields.identifier)}
            placeholder={REG_NO_EXAMPLE}
          />
        </Field>

        <Field label="Password" htmlFor="password" error={fields.password} required>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(fields.password)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Forgot your password?
          </Link>
        </div>

        <Button type="submit" className="w-full" disabled={busy} size="lg">
          <LogIn />
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthShell title="Sign in">{null}</AuthShell>}>
      <LoginForm />
    </Suspense>
  );
}
