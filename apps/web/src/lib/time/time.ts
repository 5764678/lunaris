/**
 * Time utilities for the analysis timeline. All values are UTC milliseconds since the
 * Unix epoch; formatting is always UTC (never the browser's local zone).
 */

export const SECOND_MS = 1_000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/**
 * Default analysis window length: 30 days, which spans one mean synodic month
 * (≈ 29.53 days) — the period of the lunar day/night cycle.
 */
export const DEFAULT_WINDOW_MS = 30 * DAY_MS;

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** `2026-11-04 09:30:12` (UTC). */
export function formatUtc(ms: number, withSeconds = true): string {
  const d = new Date(ms);
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}${
    withSeconds ? `:${pad(d.getUTCSeconds())}` : ""
  }`;
  return `${date} ${time}`;
}

/** `2026-11-04` (UTC). */
export function formatUtcDate(ms: number): string {
  return formatUtc(ms).slice(0, 10);
}

/** ISO 8601 with `Z`, second precision: `2026-11-04T09:30:12Z`. */
export function toIsoUtc(ms: number): string {
  return `${new Date(Math.floor(ms / SECOND_MS) * SECOND_MS).toISOString().slice(0, 19)}Z`;
}

/** Day of year (1–366), UTC. */
export function dayOfYearUtc(ms: number): number {
  const d = new Date(ms);
  return Math.floor((ms - Date.UTC(d.getUTCFullYear(), 0, 1)) / DAY_MS) + 1;
}

/** Signed compact duration: `+2d 03h 15m`, `−45m 10s`, `+0s`. */
export function formatOffset(ms: number): string {
  const sign = ms < 0 ? "−" : "+";
  let rest = Math.floor(Math.abs(ms) / SECOND_MS);
  const days = Math.floor(rest / 86_400);
  rest -= days * 86_400;
  const hours = Math.floor(rest / 3_600);
  rest -= hours * 3_600;
  const minutes = Math.floor(rest / 60);
  const seconds = rest - minutes * 60;
  if (days > 0) return `${sign}${days}d ${pad(hours)}h ${pad(minutes)}m`;
  if (hours > 0) return `${sign}${hours}h ${pad(minutes)}m`;
  if (minutes > 0) return `${sign}${minutes}m ${pad(seconds)}s`;
  return `${sign}${seconds}s`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface TimeTick {
  ms: number;
  /** Fractional position within the window, [0, 1]. */
  position: number;
  label: string;
  major: boolean;
}

/**
 * Day ticks (UTC midnights) inside [startMs, endMs]. Every `majorEvery`-th day from the
 * window start is a labeled major tick.
 */
export function dayTicks(startMs: number, endMs: number, majorEvery = 5): TimeTick[] {
  if (!(endMs > startMs)) return [];
  const span = endMs - startMs;
  const ticks: TimeTick[] = [];
  let index = 0;
  for (let t = Math.ceil(startMs / DAY_MS) * DAY_MS; t <= endMs; t += DAY_MS, index += 1) {
    const major = index % majorEvery === 0;
    ticks.push({
      ms: t,
      position: (t - startMs) / span,
      label: major ? formatUtcDate(t).slice(5) : "",
      major,
    });
  }
  return ticks;
}

/** Simulation rates: simulated seconds per real second. */
export const PLAYBACK_RATES = [
  { value: 60, label: "1 min/s" },
  { value: 3_600, label: "1 h/s" },
  { value: 21_600, label: "6 h/s" },
  { value: 86_400, label: "1 d/s" },
] as const;
