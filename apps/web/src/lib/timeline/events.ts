/**
 * "Next sunset / next Earth rise": the next change in a body's visibility after a chosen moment,
 * read from the visibility windows the timeline analysis already returns. Nothing is recomputed.
 */
import type { components } from "@lunaris/shared-types";

export type VisibilityWindow = components["schemas"]["VisibilityWindow"];

export interface NextEvent {
  /** Whether any part of the body is above the skyline at the chosen moment. */
  state: "up" | "down";
  /** The next change: it sets (was up) or rises (was down). Null when none happens in the period. */
  change: { kind: "set" | "rise"; atMs: number; inMs: number } | null;
  /** When the period ends, for "stays up until the end of the period". */
  periodEndMs: number;
}

/**
 * Looks for the first change after `atMs`. A window the chosen moment sits inside ends in a set
 * unless it runs to the end of the period (`censored_end`), where the real end is unknown. A moment
 * outside every window ends in a rise at the next window's start, if there is one.
 * Returns null when `atMs` lies outside the analysed period, where nothing can be said.
 */
export function nextVisibilityEvent(
  windows: readonly VisibilityWindow[],
  atMs: number,
  periodStartMs: number,
  periodEndMs: number,
): NextEvent | null {
  if (!(atMs >= periodStartMs && atMs <= periodEndMs)) return null;
  const spans = windows
    .map((w) => ({ start: Date.parse(w.start_utc), end: Date.parse(w.end_utc), censoredEnd: w.censored_end }))
    .filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end))
    .sort((a, b) => a.start - b.start);

  const inside = spans.find((w) => atMs >= w.start && atMs < w.end);
  if (inside) {
    const change = inside.censoredEnd
      ? null
      : { kind: "set" as const, atMs: inside.end, inMs: inside.end - atMs };
    return { state: "up", change, periodEndMs };
  }
  const next = spans.find((w) => w.start > atMs);
  return {
    state: "down",
    change: next ? { kind: "rise", atMs: next.start, inMs: next.start - atMs } : null,
    periodEndMs,
  };
}

/** `3 d 4 h`, `5 h 20 min`, `40 min`: a span in the two biggest units that matter. */
export function formatSpan(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60_000));
  const days = Math.floor(totalMin / 1_440);
  const hours = Math.floor((totalMin % 1_440) / 60);
  const minutes = totalMin % 60;
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}
