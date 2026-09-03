"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Catches anything thrown while rendering a route — most often a dropped
 * MongoDB connection. Next.js replaces the message with a digest in
 * production, so the real text is only shown in development.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <main
      id="main"
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-16 text-center"
    >
      <span className="grid size-14 place-items-center rounded-2xl bg-destructive/12 text-destructive">
        <AlertTriangle className="size-7" />
      </span>

      <h1 className="mt-6 font-display text-2xl font-bold sm:text-3xl">
        Something went wrong at our end
      </h1>
      <p className="mt-3 max-w-md text-balance text-muted-foreground">
        This is usually a temporary problem reaching the database. Nothing you submitted has been
        lost — try again in a moment.
      </p>

      {process.env.NODE_ENV === "development" && (
        <pre className="mt-5 max-w-xl overflow-x-auto rounded-lg border border-border bg-muted p-3 text-left font-mono text-xs">
          {error.message}
        </pre>
      )}

      {error.digest && (
        <p className="mt-4 font-mono text-xs text-muted-foreground">
          Reference: {error.digest}
        </p>
      )}

      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>
          <RotateCcw />
          Try again
        </Button>
        <Link href="/">
          <Button variant="outline">Go to the home page</Button>
        </Link>
      </div>
    </main>
  );
}
