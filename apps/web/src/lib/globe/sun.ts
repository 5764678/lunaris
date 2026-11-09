import type { SunDirectionSeries } from "@/lib/api/client";
import { directionAt, type BodyDirectionSeries, type Direction } from "@/lib/terrain/sun";
import { parseUtc } from "@/lib/timeline/series";

export interface GlobeSunSeries {
  directions: BodyDirectionSeries;
  subsolarLatDeg: number[];
  subsolarLonDeg: number[];
}

export function toGlobeSunSeries(series: SunDirectionSeries): GlobeSunSeries {
  const s = series.samples;
  return {
    directions: {
      epochsMs: s.map((x) => parseUtc(x.epoch_utc)),
      directions: s.map(
        (x) => [x.direction_moon_me[0]!, x.direction_moon_me[1]!, x.direction_moon_me[2]!] as const,
      ),
      elevationDeg: s.map(() => 0),
      azimuthDeg: s.map(() => 0),
    },
    subsolarLatDeg: s.map((x) => x.subsolar_latitude_deg),
    subsolarLonDeg: s.map((x) => x.subsolar_longitude_deg),
  };
}

/**
 * Sun at `ms` for display: the Moon-centred MOON_ME direction (normalised interpolation
 * between hourly samples) and the sub-solar point (latitude linear, longitude the short
 * way across 0°/360°). Null outside the sampled span — never extrapolated.
 */
export function globeSunAt(
  series: GlobeSunSeries,
  ms: number,
): { direction: Direction; subsolarLatDeg: number; subsolarLonDeg: number } | null {
  const direction = directionAt(series.directions, ms);
  if (!direction) return null;
  const t = series.directions.epochsMs;
  let lo = 0;
  let hi = t.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t[mid]! <= ms) lo = mid;
    else hi = mid;
  }
  const f = t[hi] === t[lo] ? 0 : (ms - t[lo]!) / (t[hi]! - t[lo]!);
  const lat = series.subsolarLatDeg[lo]! + f * (series.subsolarLatDeg[hi]! - series.subsolarLatDeg[lo]!);
  const lon0 = series.subsolarLonDeg[lo]!;
  const dLon = ((((series.subsolarLonDeg[hi]! - lon0) % 360) + 540) % 360) - 180;
  const lon = (((lon0 + f * dLon) % 360) + 360) % 360;
  return { direction, subsolarLatDeg: lat, subsolarLonDeg: lon };
}
