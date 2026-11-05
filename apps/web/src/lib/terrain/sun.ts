import type { BodyGeometrySample } from "@/lib/timeline/series";
import { parseUtc } from "@/lib/timeline/series";

export type Direction = readonly [number, number, number];

export interface BodyDirectionSeries {
  epochsMs: number[];
  directions: Direction[];
  elevationDeg: number[];
}

/** Prepares C2 samples (already validated by the client guard) for per-frame lookup. */
export function toDirectionSeries(samples: readonly BodyGeometrySample[]): BodyDirectionSeries {
  return {
    epochsMs: samples.map((s) => parseUtc(s.epoch_utc)),
    directions: samples.map((s) => [
      s.direction_moon_me[0]!,
      s.direction_moon_me[1]!,
      s.direction_moon_me[2]!,
    ]),
    elevationDeg: samples.map((s) => s.elevation_deg),
  };
}

function bracket(t: number[], ms: number): [number, number, number] | null {
  const n = t.length;
  if (n === 0 || ms < t[0]! || ms > t[n - 1]!) return null;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t[mid]! <= ms) lo = mid;
    else hi = mid;
  }
  const span = t[hi]! - t[lo]!;
  return [lo, hi, span > 0 ? (ms - t[lo]!) / span : 0];
}

/**
 * Apparent body direction (MOON_ME unit vector, C2 `direction_moon_me`) at `ms`, for
 * display: normalised linear interpolation between hourly samples (the Sun moves
 * ≈0.5° per hour as seen from the Moon). Null outside the sampled span.
 */
export function directionAt(series: BodyDirectionSeries, ms: number): Direction | null {
  const b = bracket(series.epochsMs, ms);
  if (!b) return null;
  const [lo, hi, f] = b;
  const a = series.directions[lo]!;
  const c = series.directions[hi]!;
  const x = a[0] + f * (c[0] - a[0]);
  const y = a[1] + f * (c[1] - a[1]);
  const z = a[2] + f * (c[2] - a[2]);
  const len = Math.hypot(x, y, z);
  return len > 0 ? [x / len, y / len, z / len] : null;
}

/** Display interpolation of the body's elevation (astronomical horizon) at `ms`. */
export function elevationAtMs(series: BodyDirectionSeries, ms: number): number | null {
  const b = bracket(series.epochsMs, ms);
  if (!b) return null;
  const [lo, hi, f] = b;
  return series.elevationDeg[lo]! + f * (series.elevationDeg[hi]! - series.elevationDeg[lo]!);
}
