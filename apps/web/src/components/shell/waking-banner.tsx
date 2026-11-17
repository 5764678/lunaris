"use client";

import { useConnection, useRetryFailedRequestsOnceAnswered } from "@/lib/api/queries";

/**
 * Tells the visitor why nothing has loaded yet while a sleeping server wakes up: the free hosting
 * plan stops an idle server, and the first visit then waits up to a minute. It floats over the
 * page without moving anything, and the live region stays mounted so screen readers announce it.
 *
 * It also retries whatever failed during the wait as soon as the server answers, so what the
 * message promises (the page fills in by itself) is true.
 */
export function WakingBanner() {
  const state = useConnection();
  useRetryFailedRequestsOnceAnswered();

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-14 z-40 flex justify-center px-4"
    >
      {state.kind === "waking" && (
        <p
          data-testid="waking-banner"
          className="pointer-events-auto flex max-w-xl items-start gap-2.5 rounded-md border border-warn/40 bg-surface px-3.5 py-2.5 text-2xs leading-relaxed text-foreground shadow-lg shadow-foreground/15"
        >
          <span className="mt-1 size-1.5 shrink-0 animate-pulse rounded-full bg-warn" aria-hidden="true" />
          <span>
            <strong className="font-medium">Waking the server, this can take up to a minute.</strong>{" "}
            <span className="text-muted-foreground">
              The free hosting puts it to sleep when nobody has used it for a while. This page fills in by
              itself once it answers.
            </span>
          </span>
        </p>
      )}
    </div>
  );
}
