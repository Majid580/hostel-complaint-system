"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Keeps a form's contents in localStorage while it is being filled in.
 *
 * The complaint form is long, and it is filled in on hostel Wi-Fi from a phone.
 * Losing a half-written complaint to a dropped signal, an accidental back
 * gesture, or the browser reclaiming the tab for memory is the single most
 * annoying thing this app could do to someone who is already annoyed.
 *
 * Deliberately localStorage and not the server: a draft is not a complaint, and
 * nobody else should be able to see one. It stays on the student's own device
 * until they actually file it.
 *
 * The read is gated on `useHydrated`, so it only happens on the client after
 * the markup has been matched — the server has no localStorage, and reading it
 * during the first render would make the two disagree.
 */

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Private browsing, or storage disabled. A draft is a nicety, not a feature
    // worth breaking the form over.
    return null;
  }
}

export function useDraft<T extends Record<string, unknown>>(
  key: string,
  current: T,
  options: { enabled?: boolean } = {},
) {
  const { enabled = true } = options;

  const [raw, setRaw] = useState<string | null>(null);

  // Read once, on mount. This is the case the "no setState in an effect" rule
  // exists to allow: synchronising with an external system that does not exist
  // on the server. Reading during render instead would put a banner in the
  // client markup that the server never rendered.
  useEffect(() => {
    if (!enabled) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setRaw(read(key));
  }, [key, enabled]);

  const restored = useMemo(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null; // a corrupt draft is simply no draft
    }
  }, [raw]);

  const hasSaved = useRef(false);

  // Save as they type, debounced — localStorage writes are synchronous, and one
  // per keystroke on a cheap phone is wasteful.
  useEffect(() => {
    if (!enabled) return;

    const timer = window.setTimeout(() => {
      const hasContent = Object.values(current).some((value) =>
        typeof value === "string"
          ? value.trim().length > 0
          : Array.isArray(value)
            ? value.length > 0
            : false,
      );

      try {
        if (hasContent) {
          window.localStorage.setItem(key, JSON.stringify(current));
          hasSaved.current = true;
        } else if (hasSaved.current) {
          window.localStorage.removeItem(key);
          hasSaved.current = false;
        }
      } catch {
        /* quota or private mode — not worth interrupting anyone over */
      }
    }, 600);

    return () => window.clearTimeout(timer);
  }, [key, current, enabled]);

  const discard = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* nothing to do */
    }
    hasSaved.current = false;
    setRaw(null);
  }, [key]);

  return { restored, discard };
}
