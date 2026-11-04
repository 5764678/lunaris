/**
 * LUNARIS wire conventions (authoritative: docs/API.md § Conventions, docs/SCIENCE.md).
 *
 * - Field names are snake_case on the wire, identical to the Python API, so no mapping
 *   layer can silently drop or rename a unit.
 * - Every dimensional quantity carries its unit as a suffix:
 *   `_deg` degrees, `_rad` radians (internal only), `_m` metres, `_km` kilometres
 *   (display only), `_s` seconds, `_bytes` bytes, `_w` watts, `_wh` watt-hours.
 * - Timestamps are ISO 8601 strings in UTC with an explicit offset (`…Z`), suffix `_utc`.
 * - Surface coordinates are planetocentric, body-fixed MOON_ME, latitude in [-90, 90],
 *   east longitude in [0, 360).
 * - Azimuth is measured clockwise from local north (0 = N, 90 = E); elevation is the
 *   angle above the local horizontal plane of the reference sphere. Both geometric:
 *   the Moon has no atmosphere, so no refraction model applies.
 * - Fractions are unitless in [0, 1], suffix `_fraction`.
 */

/** ISO 8601 UTC timestamp, e.g. `"2026-11-04T09:30:00Z"`. */
export type IsoUtcTimestamp = string;

/** ISO 8601 calendar date, e.g. `"2026-11-04"`. */
export type IsoDate = string;

/** Lowercase hexadecimal SHA-256 digest (64 characters). */
export type Sha256Hex = string;

/** Body-fixed lunar frames (SPICE frame names). MOON_ME is canonical in LUNARIS. */
export type LunarFrame = "MOON_ME" | "MOON_PA";

/** Closed time interval in UTC. `start_utc` must precede `end_utc`. */
export interface TimeWindow {
  start_utc: IsoUtcTimestamp;
  end_utc: IsoUtcTimestamp;
}

/** Summary statistic of a sampled scalar field, with its unit. */
export interface ScalarStatistic {
  unit: string;
  sample_count: number;
  mean: number;
  minimum: number;
  maximum: number;
  standard_deviation: number;
  /** Optional percentiles keyed by percentile, e.g. `{ "95": 12.3 }`. */
  percentiles?: Record<string, number>;
}
