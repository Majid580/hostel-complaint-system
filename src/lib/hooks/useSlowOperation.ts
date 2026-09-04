"use client";

import { useEffect, useState } from "react";

/**
 * True once something has been running longer than people expect it to.
 *
 * Hostel Wi-Fi is slow and a phone photo is several megabytes. A progress bar
 * that has been sitting at 40% for fifteen seconds looks broken, and the usual
 * reaction is to hit back — losing the whole form. A single line of "still
 * going, big file on a slow connection" is the difference between waiting and
 * giving up.
 */
export function useSlowOperation(active: boolean, afterMs = 8000): boolean {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    if (!active) return;

    const timer = window.setTimeout(() => setElapsed(true), afterMs);

    // Reset on the way out rather than on the way in — clearing state in the
    // effect body would fire a second render on every mount.
    return () => {
      window.clearTimeout(timer);
      setElapsed(false);
    };
  }, [active, afterMs]);

  // Guard on `active` too, so a stale `true` can never leak into the next run.
  return active && elapsed;
}
