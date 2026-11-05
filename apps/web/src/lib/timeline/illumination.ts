import type { TimelineAnalysis } from "@/lib/api/client";

import { parseUtc } from "./series";

export interface SiteIlluminationAtEpoch {
  /** Epoch of the computed sample shown (nearest to the requested epoch). */
  sampleMs: number;
  /** Fraction of the solar disk above the astronomical horizon (C0 plane), [0, 1]. */
  astronomical: number;
  /** Fraction above the terrain horizon; null when no horizon mask is served. */
  terrain: number | null;
  /** True when the terrain fraction is an upper bound (truncated mask rays). */
  terrainUpperBound: boolean;
  /** Window summary: terrain horizon when available, else astronomical (labelled). */
  summary: {
    horizon: "terrain" | "astronomical";
    meanVisibleDiskFraction: number;
    illuminatedFraction: number;
    anyTruncated: boolean;
  };
}

/**
 * The selected site's computed illumination (C4) at the epoch. Takes the computed sample
 * nearest the epoch (within half a step) instead of interpolating a computed fraction,
 * and never turns a missing terrain value into 0. Null outside the window.
 */
export function siteIlluminationAt(analysis: TimelineAnalysis, ms: number): SiteIlluminationAtEpoch | null {
  const samples = analysis.illumination.samples;
  if (samples.length === 0) return null;
  const t0 = parseUtc(samples[0]!.epoch_utc);
  const step = analysis.step_s * 1000;
  const i = Math.round((ms - t0) / step);
  if (i < 0 || i >= samples.length) return null;
  const s = samples[i]!;
  const sampleMs = parseUtc(s.epoch_utc);
  if (Math.abs(sampleMs - ms) > step / 2 + 1) return null;
  const terrainSummary = analysis.illumination.terrain;
  const summary = terrainSummary ?? analysis.illumination.astronomical;
  return {
    sampleMs,
    astronomical: s.astronomical_visible_fraction,
    terrain: s.terrain_visible_fraction ?? null,
    terrainUpperBound: s.terrain_truncated === true,
    summary: {
      horizon: terrainSummary ? "terrain" : "astronomical",
      meanVisibleDiskFraction: summary.mean_visible_disk_fraction,
      illuminatedFraction: summary.illuminated_fraction,
      anyTruncated: summary.any_truncated,
    },
  };
}
