import { describe, expect, it } from "vitest";

import type { TimelineAnalysis } from "@/lib/api/client";

import { formatFractionReadout, fractionAt, fractionSeriesFromTimeline } from "./fractions";

// SYNTHETIC analysis — invented fractions, not lunar results.
const T0 = Date.UTC(2026, 10, 5, 0);
const H = 3_600_000;
const ev = { kind: "calculation", statement: "synthetic", sources: [], method: "x", assumptions: [] };

function analysis(mask: boolean): TimelineAnalysis {
  const samples = (truncated: boolean) =>
    [0, 1, 2].map((h) => ({
      epoch_utc: new Date(T0 + h * H).toISOString(),
      astronomical_visible_fraction: 1 - h * 0.5,
      terrain_visible_fraction: mask ? (h === 1 ? null : 0.25 * h) : null,
      terrain_truncated: mask ? truncated : null,
      line_of_sight: h === 2 ? "below_geometric_horizon" : "clear",
    }));
  return {
    step_s: 3600,
    terrain_horizon_available: mask,
    illumination: { evidence: ev, samples: samples(false) },
    earth_visibility: { evidence: ev, samples: samples(true) },
  } as unknown as TimelineAnalysis;
}

describe("fractionSeriesFromTimeline", () => {
  it("keeps missing terrain values null and reports availability", () => {
    const { illumination, los } = fractionSeriesFromTimeline(analysis(true));
    expect(illumination.terrain).toEqual([0, null, 0.5]);
    expect(illumination.terrainAvailable).toBe(true);
    expect(illumination.anyUpperBound).toBe(false);
    expect(los.anyUpperBound).toBe(true);
  });

  it("marks the terrain horizon unavailable without a mask", () => {
    const { illumination } = fractionSeriesFromTimeline(analysis(false));
    expect(illumination.terrainAvailable).toBe(false);
    expect(illumination.terrain.every((v) => v === null)).toBe(true);
    expect(illumination.astronomical).toEqual([1, 0.5, 0]);
  });
});

describe("fractionAt", () => {
  it("returns the nearest computed sample and nothing outside the window", () => {
    const { illumination } = fractionSeriesFromTimeline(analysis(true));
    expect(fractionAt(illumination, T0 + 1.6 * H)).toMatchObject({ astronomical: 0, terrain: 0.5 });
    expect(fractionAt(illumination, T0 + 1.2 * H)).toMatchObject({ astronomical: 0.5, terrain: null });
    expect(fractionAt(illumination, T0 - H)).toBeNull();
  });
});

describe("line-of-sight states", () => {
  it("carries the per-sample state for the Earth lane", () => {
    const { los } = fractionSeriesFromTimeline(analysis(true));
    expect(fractionAt(los, T0)!.state).toBe("clear");
    expect(fractionAt(los, T0 + 2 * H)!.state).toBe("below_geometric_horizon");
  });
});

describe("formatFractionReadout", () => {
  it("shows the terrain share first and the no-hills share beside it", () => {
    expect(formatFractionReadout({ anyUpperBound: false }, { astronomical: 1, terrain: 0.42 })).toBe(
      "42 % · no hills 100 %",
    );
  });

  it("marks the terrain share as an upper bound when mask rays ran out of map", () => {
    expect(formatFractionReadout({ anyUpperBound: true }, { astronomical: 1, terrain: 0.42 })).toBe(
      "≤ 42 % · no hills 100 %",
    );
  });

  it("shows the no-hills share alone, labelled, where no terrain mask is served", () => {
    expect(formatFractionReadout({ anyUpperBound: false }, { astronomical: 1, terrain: null })).toBe(
      "no hills 100 % · terrain n/a",
    );
  });

  it("is a dash where there is no computed sample, never 0 %", () => {
    expect(formatFractionReadout({ anyUpperBound: false }, null)).toBe("—");
  });

  it("keeps a real 0 % terrain share as 0 %", () => {
    expect(formatFractionReadout({ anyUpperBound: false }, { astronomical: 0.3, terrain: 0 })).toBe(
      "0 % · no hills 30 %",
    );
  });
});
