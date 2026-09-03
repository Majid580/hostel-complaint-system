"use client";

import { useSyncExternalStore } from "react";

/** Nothing to subscribe to — the value flips once, at hydration. */
const subscribe = () => () => {};

/**
 * `false` while rendering on the server and during the first client render,
 * `true` afterwards.
 *
 * Use it to gate anything that reads browser-only state (`navigator`,
 * `matchMedia`, the resolved theme). Reading those during render would make the
 * server and client markup disagree; doing it in an effect instead means a
 * setState on mount, which cascades a second render. `useSyncExternalStore`
 * expresses the same thing as what it actually is — an external store whose
 * server snapshot differs from its client snapshot.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
