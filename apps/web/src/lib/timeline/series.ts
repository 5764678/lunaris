import type { Evidence, SiteEphemeris, components } from "@lunaris/shared-types";

/** One C2 sample from `GET /api/v1/sites/{id}/ephemeris` (generated contract). */
export type BodyGeometrySample = components["schemas"]["EphemerisSample"];

export type BodyId = "sun" | "earth";

/** Elevation time series for one body, ready to plot. Times are UTC epoch milliseconds. */
export interface ElevationSeries {
  body: BodyId;
  epochsMs: number[];
  elevationDeg: number[];
  angularRadiusDeg: number[];
  evidence: Evidence;
}

export class SeriesError extends Error {
  override name = "SeriesError";
}

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** Parses an ISO 8601 UTC timestamp with a `Z` suffix (API convention) to epoch ms. */
export function parseUtc(value: string): number {
  if (!ISO_UTC.test(value)) throw new SeriesError(`not an ISO 8601 UTC timestamp: ${value}`);
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new SeriesError(`invalid timestamp: ${value}`);
  return ms;
}

/**
 * Builds a plottable elevation series from C2 samples. Rejects rather than repairs:
 * non-finite values, unsorted or duplicate epochs, and empty input are errors, so a
 * malformed response can never be drawn as if it were computed data.
 */
export function toElevationSeries(
  body: BodyId,
  samples: readonly BodyGeometrySample[],
  evidence: Evidence,
): ElevationSeries {
  if (samples.length === 0) throw new SeriesError(`${body}: no samples`);
  const epochsMs: number[] = [];
  const elevationDeg: number[] = [];
  const angularRadiusDeg: number[] = [];
  for (const [i, s] of samples.entries()) {
    const ms = parseUtc(s.epoch_utc);
    if (i > 0 && ms <= epochsMs[i - 1]!)
      throw new SeriesError(`${body}: epochs not strictly increasing at ${i}`);
    if (!Number.isFinite(s.elevation_deg) || s.elevation_deg < -90 || s.elevation_deg > 90) {
      throw new SeriesError(`${body}: elevation out of range at ${s.epoch_utc}`);
    }
    if (!Number.isFinite(s.angular_radius_deg) || s.angular_radius_deg <= 0) {
      throw new SeriesError(`${body}: invalid angular radius at ${s.epoch_utc}`);
    }
    epochsMs.push(ms);
    elevationDeg.push(s.elevation_deg);
    angularRadiusDeg.push(s.angular_radius_deg);
  }
  return { body, epochsMs, elevationDeg, angularRadiusDeg, evidence };
}

/**
 * Display-only linear interpolation of the elevation at `ms`, for the cursor readout.
 * Returns null outside the sampled span (never extrapolates).
 */
export function elevationAt(series: ElevationSeries, ms: number): number | null {
  const t = series.epochsMs;
  const n = t.length;
  if (n === 0 || ms < t[0]! || ms > t[n - 1]!) return null;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t[mid]! <= ms) lo = mid;
    else hi = mid;
  }
  if (lo === hi || t[hi] === t[lo]) return series.elevationDeg[lo]!;
  const f = (ms - t[lo]!) / (t[hi]! - t[lo]!);
  return series.elevationDeg[lo]! + f * (series.elevationDeg[hi]! - series.elevationDeg[lo]!);
}

/** Symmetric y-range for a lane, always including the 0° astronomical horizon. */
export function elevationRange(series: ElevationSeries, minSpanDeg = 1): [number, number] {
  let max = 0;
  for (const [i, e] of series.elevationDeg.entries()) {
    max = Math.max(max, Math.abs(e) + series.angularRadiusDeg[i]!);
  }
  const half = Math.max(minSpanDeg / 2, max * 1.1);
  return [-half, half];
}

/** Elevation series per body from an ephemeris response; bodies without samples are omitted. */
export function seriesFromEphemeris(ephemeris: SiteEphemeris): Partial<Record<BodyId, ElevationSeries>> {
  const out: Partial<Record<BodyId, ElevationSeries>> = {};
  for (const body of ephemeris.bodies) {
    if (body.samples.length === 0) continue;
    out[body.body] = toElevationSeries(body.body, body.samples, body.evidence);
  }
  return out;
}
