import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { publicEnv } from "@/lib/config/env";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  wide,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="bg-grid flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-6 flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
          <ShieldCheck className="size-5" />
        </span>
        <span className="leading-tight">
          <span className="block font-display text-[15px] font-bold">{publicEnv.appName}</span>
          <span className="block text-[11px] text-muted-foreground">
            {publicEnv.instituteName}
          </span>
        </span>
      </Link>

      <div
        className={`w-full rounded-2xl border border-border bg-card p-6 card-elevated sm:p-8 ${
          wide ? "max-w-2xl" : "max-w-md"
        }`}
      >
        <h1 className="font-display text-xl font-bold leading-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted-foreground text-pretty">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>

      {footer && <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div>}
    </div>
  );
}
