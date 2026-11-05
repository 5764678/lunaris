import { describe, expect, it } from "vitest";

import type { TimelineAnalysis } from "@/lib/api/client";

import { siteIlluminationAt } from "./illumination";

// SYNTHETIC analysis — invented fractions that exercise the lookup, not lunar results.
const T0 = Date.UTC(2026, 10, 5, 0);
const H = 3_600_000;
const summary = (mean: number) => ({
  horizon: "x",
  mean_visible_disk_fraction: mean,
  illuminated_fraction: mean + 0.1,
  fully_lit_fraction: 0,
  longest_darkness_s: 0,
  longest_darkness_censored: false,
  longest_illumination_s: 0,
  longest_illumination_censored: false,
  any_truncated: true,
  resolution_s: 3600,
  sunlit_windows: [],
});

function analysis(terrain: boolean): TimelineAnalysis {
  return {
    step_s: 3600,
    illumination: {
      astronomical: summary(0.9),
      terrain: terrain ? summary(0.4) : null,
      samples: [0, 1, 2].map((h) => ({
        epoch_utc: new Date(T0 + h * H).toISOString(),
        astronomical_visible_fraction: 1,
        terrain_visible_fraction: terrain ? h * 0.25 : null,
        terrain_truncated: terrain ? h === 2 : null,
      })),
    },
  } as unknown as TimelineAnalysis;
}

describe("siteIlluminationAt", () => {
  it("returns the nearest computed sample, never an interpolated fraction", () => {
    const v = siteIlluminationAt(analysis(true), T0 + 1.4 * H)!;
    expect(v.sampleMs).toBe(T0 + H);
    expect(v.terrain).toBe(0.25);
    expect(v.astronomical).toBe(1);
    expect(v.summary).toMatchObject({ horizon: "terrain", meanVisibleDiskFraction: 0.4 });
  });

  it("flags a truncated terrain value as an upper bound", () => {
    expect(siteIlluminationAt(analysis(true), T0 + 2 * H)!.terrainUpperBound).toBe(true);
  });

  it("keeps a missing terrain horizon null (never 0) and labels the astronomical summary", () => {
    const v = siteIlluminationAt(analysis(false), T0)!;
    expect(v.terrain).toBeNull();
    expect(v.summary.horizon).toBe("astronomical");
    expect(v.summary.meanVisibleDiskFraction).toBe(0.9);
  });

  it("returns null outside the window", () => {
    expect(siteIlluminationAt(analysis(true), T0 - H)).toBeNull();
    expect(siteIlluminationAt(analysis(true), T0 + 3 * H)).toBeNull();
  });
});
