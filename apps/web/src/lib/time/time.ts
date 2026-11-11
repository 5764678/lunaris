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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** `4 Nov 2026 09:30` (UTC), with month names so `11-10` can never be read as 11 October. */
export function formatUtcReadable(ms: number, withSeconds = false): string {
  const d = new Date(ms);
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}${
    withSeconds ? `:${pad(d.getUTCSeconds())}` : ""
  }`;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${time}`;
}

/** `4 Nov` (UTC): a short date for chart axes. */
export function formatUtcDayMonth(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedParts(ms: number, timeZone?: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** The zone's offset from UTC at `ms`, in minutes (Bangkok is 420). */
export function utcOffsetMinutes(ms: number, timeZone?: string): number {
  const p = zonedParts(ms, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(ms / SECOND_MS) * SECOND_MS) / MINUTE_MS);
}

/** `UTC+7`, `UTC−3:30`, `UTC`. */
export function utcOffsetLabel(ms: number, timeZone?: string): string {
  const minutes = utcOffsetMinutes(ms, timeZone);
  if (minutes === 0) return "UTC";
  const sign = minutes < 0 ? "−" : "+";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m === 0 ? "" : `:${pad(m)}`}`;
}

/**
 * The visitor's local time: `22:09`, or `11 Nov 22:09` when the local date differs from the UTC
 * date, so the pair is never read as the same day. `timeZone` defaults to the browser's zone.
 */
export function formatLocalTime(ms: number, withSeconds = false, timeZone?: string): string {
  const p = zonedParts(ms, timeZone);
  const time = `${pad(p.hour)}:${pad(p.minute)}${withSeconds ? `:${pad(p.second)}` : ""}`;
  const utc = new Date(ms);
  const sameDay =
    p.year === utc.getUTCFullYear() && p.month === utc.getUTCMonth() + 1 && p.day === utc.getUTCDate();
  return sameDay ? time : `${p.day} ${MONTHS[p.month - 1]} ${time}`;
}

/** The visitor's local date and time, always with the date: `11 Nov 2026 22:09`. */
export function formatLocalReadable(ms: number, withSeconds = false, timeZone?: string): string {
  const p = zonedParts(ms, timeZone);
  const time = `${pad(p.hour)}:${pad(p.minute)}${withSeconds ? `:${pad(p.second)}` : ""}`;
  return `${p.day} ${MONTHS[p.month - 1]} ${p.year} ${time}`;
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
      label: major ? formatUtcDayMonth(t) : "",
      major,
    });
  }
  return ticks;
}

/** Simulation rates: simulated seconds per real second. */
export const PLAYBACK_RATES = [
  { value: 60, label: "1 min" },
  { value: 3_600, label: "1 hour" },
  { value: 21_600, label: "6 hours" },
  { value: 86_400, label: "1 day" },
] as const;
