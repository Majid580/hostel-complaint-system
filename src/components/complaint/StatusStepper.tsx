import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_META, type ComplaintStatus } from "@/lib/domain/constants";
import { STEPPER_STAGES } from "@/lib/domain/statusMachine";

/**
 * The one thing a student opens this page to find out: is anything happening?
 *
 * Two presentations rather than one squeezed. On a phone, six numbered circles
 * with no room for labels say nothing — so the small screen gets a named stage
 * and a filled bar. From `sm` up there is room for the full labelled track.
 * Rejected and reopened complaints are shown honestly rather than being forced
 * onto the happy path.
 */
export function StatusStepper({ status }: { status: ComplaintStatus }) {
  const meta = STATUS_META[status];

  if (status === "REJECTED") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/8 p-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-destructive/15 text-destructive">
          <X className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold">Rejected</p>
          <p className="text-xs text-muted-foreground">{meta.description}</p>
        </div>
      </div>
    );
  }

  const current = meta.stage;
  const total = STEPPER_STAGES.length;
  const currentLabel = STEPPER_STAGES.find((s) => s.stage === current)?.label ?? meta.label;
  const percent = Math.round(((current + 1) / total) * 100);

  return (
    <div>
      {/* ---- Phone: name the stage, then show the distance travelled ---- */}
      <div className="sm:hidden">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-[15px] font-semibold">{currentLabel}</p>
          <p className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
            {current + 1} / {total}
          </p>
        </div>
        <div
          className="mt-2 flex gap-1"
          role="img"
          aria-label={`Stage ${current + 1} of ${total}: ${currentLabel}`}
        >
          {STEPPER_STAGES.map((stage) => (
            <span
              key={stage.stage}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                stage.stage <= current ? "bg-primary" : "bg-border",
              )}
            />
          ))}
        </div>
        <p className="sr-only">{percent}% complete</p>
      </div>

      {/* ---- Tablet and up: the full labelled track ---- */}
      <ol className="hidden items-center sm:flex" aria-label="Progress">
        {STEPPER_STAGES.map((stage, index) => {
          const done = current > stage.stage;
          const active = current === stage.stage;
          const isLast = index === STEPPER_STAGES.length - 1;

          return (
            <li key={stage.stage} className={cn("flex items-center", !isLast && "flex-1")}>
              <div className="flex flex-col items-center gap-1.5">
                <span
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full border-2 text-[11px] font-bold transition-colors",
                    done && "border-primary bg-primary text-primary-foreground",
                    active && "border-primary bg-primary/12 text-primary ring-4 ring-primary/12",
                    !done && !active && "border-border bg-card text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
                </span>
                <span
                  className={cn(
                    "text-center text-[11px] leading-tight",
                    active ? "font-semibold text-foreground" : "text-muted-foreground",
                  )}
                >
                  {stage.label}
                </span>
              </div>
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "mx-1 mb-5 h-0.5 flex-1 rounded-full",
                    done ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>

      {status === "REOPENED" && (
        <p className="mt-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs font-medium">
          This complaint was reopened — the work is not finished.
        </p>
      )}
    </div>
  );
}
