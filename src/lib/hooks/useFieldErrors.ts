"use client";

import { useCallback, useState } from "react";

/**
 * Shared plumbing for "tell the user what is wrong, where it is wrong".
 *
 * Every form in this app follows the same rules, and they are worth stating
 * once rather than re-deriving per form:
 *
 *   - The submit button is never disabled for being incomplete. A disabled
 *     button cannot explain itself: you tap it, nothing happens, and you are
 *     left hunting for the reason.
 *   - Submitting an invalid form answers immediately, and moves you to the
 *     first thing that needs fixing.
 *   - A field is re-checked when you leave it, so a mistake surfaces where it
 *     was made rather than at the bottom of a long form.
 *   - An error disappears the moment it stops being true, so nothing nags.
 *
 * `order` decides both which problem is jumped to first and the order they are
 * listed in the summary — keep it in visual order, top to bottom.
 */
export function useFieldErrors(order: readonly string[]) {
  const [fields, setFields] = useState<Record<string, string>>({});

  /** Scroll a field into view and focus it. Group ids get scrolled to only. */
  const jumpTo = useCallback((name: string) => {
    const el =
      document.getElementById(name) ?? document.getElementById(`${name}-group`);
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center" });

    // Focusing a fieldset or a button grid would be meaningless, and focusing
    // mid-scroll fights the smooth scroll, so wait for it to settle.
    const focusable =
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement;
    if (focusable) window.setTimeout(() => el.focus({ preventScroll: true }), 300);
  }, []);

  /** Show every problem at once and jump to the first, in `order`. */
  const showProblems = useCallback(
    (problems: Record<string, string>) => {
      setFields(problems);
      const first = order.find((name) => problems[name]);
      if (first) jumpTo(first);
    },
    [order, jumpTo],
  );

  /** Re-check one field, typically on blur. */
  const checkField = useCallback((name: string, problems: Record<string, string>) => {
    setFields((prev) => {
      const next = { ...prev };
      if (problems[name]) next[name] = problems[name];
      else delete next[name];
      return next;
    });
  }, []);

  /** Drop a field's error as soon as it is no longer true. */
  const clearField = useCallback((name: string) => {
    setFields((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setFields({}), []);

  return {
    fields,
    setFields,
    jumpTo,
    showProblems,
    checkField,
    clearField,
    clearAll,
    hasProblems: Object.keys(fields).length > 0,
  };
}
