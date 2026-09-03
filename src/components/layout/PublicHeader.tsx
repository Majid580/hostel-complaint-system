import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { publicEnv } from "@/lib/config/env";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * The bar shared by every page that is reachable without signing in
 * (`/`, `/track`, `/transparency`). `current` drops the link to the page you
 * are already on.
 */
export async function PublicHeader({ current }: { current?: "track" | "transparency" }) {
  const user = await getCurrentUser();
  const homeHref = user ? (user.role === "STUDENT" ? "/student" : "/staff") : "/login";

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-5">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-lg">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-display text-[15px] font-semibold">
              {publicEnv.appName}
            </span>
            {/* Short form on a phone; the full name has room from sm up. */}
            <span className="block truncate text-[10.5px] uppercase tracking-[0.09em] text-muted-foreground sm:hidden">
              {publicEnv.instituteShort}
            </span>
            <span className="hidden truncate text-[11px] text-muted-foreground sm:block">
              {publicEnv.instituteName}
            </span>
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-1.5">
          {current !== "track" && (
            <Link href="/track" className="hidden sm:block">
              <Button variant="ghost" size="sm">
                Track a complaint
              </Button>
            </Link>
          )}
          {current !== "transparency" && (
            <Link href="/transparency" className="hidden md:block">
              <Button variant="ghost" size="sm">
                Transparency
              </Button>
            </Link>
          )}
          <Link href={homeHref}>
            <Button size="sm">{user ? "Open dashboard" : "Sign in"}</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
