"use client";

import { useEffect, useState } from "react";

import { ApiError } from "./client";

/** A healthy API answers `/health` well inside this; slower than this means it is probably waking. */
export const SLOW_FIRST_ANSWER_MS = 2_000;

/**
 * How long a sleeping free-plan instance may take to start (about a minute on Render). Past this
 * the server counts as down rather than waking, and the connection says "Offline" as before.
 */
export const WAKE_WINDOW_MS = 90_000;

/**
 * Whether a failed health check looks like a server that is still starting: no answer in time,
 * a connection that failed only after a long wait, or the hosting proxy's own "bad gateway /
 * unavailable / gateway timeout" page. Anything else is not "waking" and must not be hidden
 * behind that message: a connection refused at once (the development API is not running), a 404,
 * a 500, or a body that is not LUNARIS.
 */
export function looksLikeWaking(error: unknown): boolean {
  if (error === null || error === undefined) return true; // nothing has failed yet: still waiting
  if (!(error instanceof ApiError)) return false;
  switch (error.kind) {
    case "timeout":
      return true;
    case "network":
      return error.elapsedMs === null || error.elapsedMs >= SLOW_FIRST_ANSWER_MS;
    case "http":
    case "invalid_response":
      return error.status === 502 || error.status === 503 || error.status === 504;
  }
}

/**
 * Retry rule for ordinary requests: the usual single retry, and no giving up while the server is
 * probably waking (it has not answered yet, the page is younger than `WAKE_WINDOW_MS`, and the
 * failure looks like a start-up failure). The panels then stay on their loading state instead of
 * flashing errors that the server is about to make untrue.
 */
export function retryWhileWaking(
  failureCount: number,
  error: unknown,
  context: { serverAnswered: boolean; sincePageLoadMs: number },
): boolean {
  if (failureCount < 1) return true;
  return !context.serverAnswered && context.sincePageLoadMs < WAKE_WINDOW_MS && looksLikeWaking(error);
}

type Phase = "fast" | "slow" | "expired";

/**
 * True while the server is probably waking up: it has never answered in this visit, the wait has
 * passed `SLOW_FIRST_ANSWER_MS` but not `WAKE_WINDOW_MS`, and the last failure (if any) looks like
 * a start-up failure. Two timers drive the phases, so nothing re-renders while the server
 * answers quickly.
 */
export function useWaking(answered: boolean, error: unknown): boolean {
  const [phase, setPhase] = useState<Phase>("fast");

  useEffect(() => {
    if (answered) return;
    const slow = setTimeout(() => setPhase("slow"), SLOW_FIRST_ANSWER_MS);
    const expired = setTimeout(() => setPhase("expired"), WAKE_WINDOW_MS);
    return () => {
      clearTimeout(slow);
      clearTimeout(expired);
    };
  }, [answered]);

  return !answered && phase === "slow" && looksLikeWaking(error);
}
