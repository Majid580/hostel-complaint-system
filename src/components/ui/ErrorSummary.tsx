"use client";

import { TriangleAlert } from "lucide-react";

/**
 * The list of everything still wrong, at the top of a form.
 *
 * On any form longer than a screen, an inline error alone is not enough — it
 * can sit below the fold with nothing to point at it. This names each problem
 * in one place and jumps to the field on tap, which matters most on a phone
 * where scrolling back and forth is the whole cost.
 */
export function ErrorSummary({
  fields,
  order,
  labels,
  onJump,
}: {
  fields: Record<string, string>;
  /** Visual order, top to bottom. */
  order: readonly string[];
  /** Human name per field key, as it reads on the form itself. */
  labels: Record<string, string>;
  onJump: (name: string) => void;
}) {
  const problems = order.filter((name) => fields[name]);
  if (problems.length === 0) return null;

  return (
    <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/8 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
        <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
        {problems.length === 1
          ? "One thing needs your attention"
          : `${problems.length} things need your attention`}
      </p>

      <ul className="mt-2 space-y-1.5">
        {problems.map((name) => (
          <li key={name}>
            <button
              type="button"
              onClick={() => onJump(name)}
              className="w-full text-left text-sm leading-snug text-destructive"
            >
              {/* Only the field name carries the link affordance; underlining the
                  whole sentence turns the list into a wall of red. */}
              <span className="font-semibold underline underline-offset-2">
                {labels[name] ?? name}
              </span>
              <span className="text-destructive/90"> — {fields[name]}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
