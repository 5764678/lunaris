import type { Evidence } from "@lunaris/shared-types";

import type { TimelineAnalysis } from "@/lib/api/client";

import { parseUtc } from "./series";

/**
 * Visible-disk fraction time series for one body (C4): the astronomical horizon always,
 * the terrain horizon only where a mask was served (null elsewhere — never 0).
 */
export interface FractionSeries {
  lane: "illumination" | "los";
  epochsMs: number[];
  astronomical: number[];
  terrain: (number | null)[];
  terrainAvailable: boolean;
  /** Any terrain value is an upper bound (truncated mask rays). */
  anyUpperBound: boolean;
  evidence: Evidence;
  stepMs: number;
  /** Earth line-of-sight state per sample (C4); empty for illumination. */
  states: LineOfSight[];
}

export type LineOfSight = "clear" | "terrain_obstructed" | "below_geometric_horizon";

export const LINE_OF_SIGHT_LABEL: Record<LineOfSight, string> = {
  clear: "In view",
  terrain_obstructed: "Blocked by terrain",
  below_geometric_horizon: "Below the skyline",
};

export function fractionSeriesFromTimeline(analysis: TimelineAnalysis): {
  illumination: FractionSeries;
  los: FractionSeries;
} {
  const stepMs = analysis.step_s * 1000;
  const build = (
    lane: FractionSeries["lane"],
    samples: {
      epoch_utc: string;
      astronomical_visible_fraction: number;
      terrain_visible_fraction?: number | null;
      terrain_truncated?: boolean | null;
      line_of_sight?: LineOfSight;
    }[],
    evidence: Evidence,
  ): FractionSeries => {
    const terrain = samples.map((s) => s.terrain_visible_fraction ?? null);
    return {
      lane,
      epochsMs: samples.map((s) => parseUtc(s.epoch_utc)),
      astronomical: samples.map((s) => s.astronomical_visible_fraction),
      terrain,
      terrainAvailable: analysis.terrain_horizon_available && terrain.some((v) => v !== null),
      anyUpperBound: samples.some((s) => s.terrain_truncated === true),
      evidence,
      stepMs,
      states: samples.flatMap((s) => (s.line_of_sight ? [s.line_of_sight] : [])),
    };
  };
  return {
    illumination: build("illumination", analysis.illumination.samples, analysis.illumination.evidence),
    los: build("los", analysis.earth_visibility.samples, analysis.earth_visibility.evidence),
  };
}

/** The computed sample nearest `ms` (within half a step); fractions are never interpolated. */
export function fractionAt(
  series: FractionSeries,
  ms: number,
): { astronomical: number; terrain: number | null; state: LineOfSight | null } | null {
  if (series.epochsMs.length === 0) return null;
  const i = Math.round((ms - series.epochsMs[0]!) / series.stepMs);
  if (i < 0 || i >= series.epochsMs.length) return null;
  if (Math.abs(series.epochsMs[i]! - ms) > series.stepMs / 2 + 1) return null;
  return {
    astronomical: series.astronomical[i]!,
    terrain: series.terrain[i]!,
    state: series.states[i] ?? null,
  };
}

const pct = (fraction: number) => `${Math.round(fraction * 100)} %`;

/**
 * The text a fraction lane and the selected-site card both show for one moment: the share of the
 * disk above the skyline with terrain in the way (an upper bound where mask rays ran out of map)
 * next to the share with no hills, or the no-hills share alone where no terrain mask is served.
 * One function, so the lane and the card cannot give different answers for the same moment.
 */
export function formatFractionReadout(
  series: Pick<FractionSeries, "anyUpperBound">,
  value: { astronomical: number; terrain: number | null } | null,
): string {
  const parts = fractionReadoutParts(series, value);
  return parts.note ? `${parts.main} ${parts.note}` : parts.main;
}

/** The same text in two pieces, so the number can be set large and the qualifier small. */
export function fractionReadoutParts(
  series: Pick<FractionSeries, "anyUpperBound">,
  value: { astronomical: number; terrain: number | null } | null,
): { main: string; note: string } {
  if (value === null) return { main: "—", note: "" };
  if (value.terrain === null) {
    return { main: pct(value.astronomical), note: "with no hills · terrain map not available" };
  }
  return {
    main: `${series.anyUpperBound ? "≤ " : ""}${pct(value.terrain)}`,
    note: `(${pct(value.astronomical)} with no hills)`,
  };
}
