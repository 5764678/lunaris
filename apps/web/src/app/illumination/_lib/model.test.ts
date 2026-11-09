import { describe, expect, it } from "vitest";

import type { TimelineAnalysis } from "@/lib/api/client";

import {
  CENSORED_NOTE,
  RADIO_LINK_FALLBACK,
  TERRAIN_UNAVAILABLE,
  WINDOWS,
  bodyTracks,
  chartRange,
  earthRows,
  horizonMaxCell,
  horizonProfile,
  isHorizonMask,
  radioLinkDisclaimer,
  siteTabs,
  sunRows,
  sunlitWindows,
  windowBounds,
  windowDurationCell,
  type HorizonMask,
} from "./model";

// Synthetic test inputs (not lunar data): shapes follow the generated contract.
const evidence = {
  kind: "calculation",
  statement: "test",
  sources: [],
  method: "test",
  assumptions: [],
} as const;

function mask(truncated: boolean[]): HorizonMask {
  const n = truncated.length;
  return {
    site_id: "s",
    latitude_deg: -89.5,
    longitude_deg: 0,
    frame: "MOON_ME",
    observer_height_m: 2,
    surface_height_m: 0,
    azimuth_step_deg: 360 / n,
    azimuth_deg: Array.from({ length: n }, (_, i) => (i * 360) / n),
    elevation_deg: Array.from({ length: n }, (_, i) => i * 0.5),
    truncated,
    truncated_count: truncated.filter(Boolean).length,
    max_range_m: 200_000,
    method: "test",
    dem: {
      dataset_id: "d",
      title: "d",
      sha256: "0",
      resolution_m: 240,
      source_url: "https://x",
      citation: "c",
    },
    evidence: { ...evidence, sources: [] },
    limitations: ["mask limit"],
  } as unknown as HorizonMask;
}

function summary(horizon: "astronomical" | "terrain", censored: boolean) {
  return {
    horizon,
    mean_visible_disk_fraction: 0.5,
    illuminated_fraction: 0.6,
    fully_lit_fraction: 0.4,
    longest_illumination_s: 7200,
    longest_illumination_censored: censored,
    longest_darkness_s: 3600,
    longest_darkness_censored: false,
    resolution_s: 3600,
    any_truncated: false,
    sunlit_windows: [
      {
        start_utc: "2027-01-01T00:00:00Z",
        end_utc: "2027-01-01T02:00:00Z",
        duration_s: 7200,
        censored_start: censored,
        censored_end: false,
      },
    ],
  };
}

function earthSummary(horizon: "astronomical" | "terrain") {
  return {
    horizon,
    visible_fraction: 0.7,
    mean_visible_disk_fraction: 0.65,
    fully_visible_fraction: 0.6,
    longest_visibility_s: 3600,
    longest_visibility_censored: false,
    longest_outage_s: 3600,
    longest_outage_censored: true,
    resolution_s: 3600,
    any_truncated: false,
    windows: [],
  };
}

function analysis(terrain: boolean, earthLimits: string[] = []): TimelineAnalysis {
  return {
    site_id: "s",
    site_name: "S",
    start_utc: "2027-01-01T00:00:00Z",
    end_utc: "2027-01-01T02:00:00Z",
    step_s: 3600,
    sample_count: 2,
    max_samples: 10_000,
    terrain_horizon_available: terrain,
    illumination: {
      body: "sun",
      samples: [
        {
          epoch_utc: "2027-01-01T00:00:00Z",
          azimuth_deg: 10,
          elevation_deg: 1,
          solar_radius_deg: 0.27,
          astronomical_visible_fraction: 1,
          terrain_horizon_elevation_deg: null,
          terrain_visible_fraction: null,
          terrain_truncated: null,
        },
      ],
      astronomical: summary("astronomical", true),
      terrain: terrain ? summary("terrain", false) : null,
      evidence,
      limitations: ["sun limit"],
    },
    earth_visibility: {
      body: "earth",
      samples: [
        {
          epoch_utc: "2027-01-01T00:00:00Z",
          azimuth_deg: 0,
          elevation_deg: -5,
          earth_radius_deg: 0.95,
          astronomical_visible_fraction: 0,
          terrain_horizon_elevation_deg: null,
          terrain_visible_fraction: null,
          terrain_truncated: null,
          line_of_sight: "below_geometric_horizon",
        },
      ],
      astronomical: earthSummary("astronomical"),
      terrain: terrain ? earthSummary("terrain") : null,
      evidence,
      limitations: earthLimits,
    },
  } as unknown as TimelineAnalysis;
}

describe("horizon mask", () => {
  it("accepts a well-formed mask and rejects mismatched arrays", () => {
    expect(isHorizonMask(mask([false, false]))).toBe(true);
    expect(isHorizonMask({ ...mask([false, false]), truncated: [false] })).toBe(false);
    expect(isHorizonMask({ ...mask([false]), elevation_deg: [Number.NaN] })).toBe(false);
    expect(isHorizonMask(null)).toBe(false);
  });

  it("closes the profile at 360° and lists truncated azimuths as lower bounds", () => {
    const p = horizonProfile(mask([false, true, false, true]));
    expect(p.azimuthDeg).toEqual([0, 90, 180, 270, 360]);
    expect(p.elevationDeg.at(-1)).toBe(p.elevationDeg[0]);
    expect(p.lowerBound).toEqual({ azimuthDeg: [90, 270], elevationDeg: [0.5, 1.5] });
    expect(p.truncatedCount).toBe(2);
  });

  it("marks the maximum skyline as a lower bound when any azimuth is truncated", () => {
    expect(horizonMaxCell(mask([false, false])).lowerBound).toBe(false);
    const c = horizonMaxCell(mask([true, false]));
    expect(c.lowerBound).toBe(true);
    expect(c.cell.value).toBe(0.5);
    expect(c.cell.limitations[0]).toMatch(/lower bound/);
  });
});

describe("chart range", () => {
  it("covers both disks and the skyline, at least 4° tall", () => {
    const tracks = bodyTracks(analysis(true));
    const [lo, hi] = chartRange(horizonProfile(mask([false, false])), [tracks.sun, tracks.earth]);
    expect(lo).toBeLessThan(-5 - 0.95);
    expect(hi).toBeGreaterThan(1 + 0.27);
    expect(hi - lo).toBeGreaterThanOrEqual(4);
  });
});

describe("summary rows", () => {
  it("never shows a missing terrain value as 0", () => {
    const rows = sunRows(analysis(false));
    for (const r of rows) {
      expect(r.terrain.cell.value).toBeNull();
      expect(r.terrain.cell.reason).toBe(TERRAIN_UNAVAILABLE);
      expect(r.astronomical.cell.value).not.toBeNull();
    }
  });

  it("flags censored runs as lower bounds with the reason in the evidence", () => {
    const longest = sunRows(analysis(true)).find((r) => r.key === "longest_illumination_s")!;
    expect(longest.astronomical.lowerBound).toBe(true);
    expect(longest.astronomical.cell.limitations[0]).toBe(CENSORED_NOTE);
    expect(longest.terrain.lowerBound).toBe(false);
    const outage = earthRows(analysis(true)).find((r) => r.key === "longest_outage_s")!;
    expect(outage.terrain.lowerBound).toBe(true);
  });

  it("carries the result's evidence and limitations", () => {
    const r = sunRows(analysis(true))[0]!;
    expect(r.terrain.cell.evidence?.statement).toBe("test");
    expect(r.terrain.cell.limitations).toContain("sun limit");
  });
});

describe("windows", () => {
  it("prefers terrain windows and flags censored ones", () => {
    expect(sunlitWindows(analysis(true)).horizon).toBe("terrain");
    const list = sunlitWindows(analysis(false));
    expect(list.horizon).toBe("astronomical");
    const c = windowDurationCell(list, list.windows[0]!);
    expect(c.lowerBound).toBe(true);
    expect(c.cell.value).toBe(7200);
    expect(c.cell.limitations).toContain(CENSORED_NOTE);
  });
});

describe("radio-link disclaimer", () => {
  it("uses the served wording, else the fallback", () => {
    const served = "Geometric line of sight only: does not imply a radio link.";
    expect(radioLinkDisclaimer(analysis(true, ["x", served]))).toBe(served);
    expect(radioLinkDisclaimer(analysis(true))).toBe(RADIO_LINK_FALLBACK);
  });
});

describe("site tabs and window", () => {
  it("puts the demo trio first, case-insensitively", () => {
    const tabs = siteTabs(
      [
        { id: "a", name: "Mine" },
        { id: "b", name: "Peak near Shackleton" },
        { id: "c", name: "Other" },
      ],
      ["peak near shackleton"],
    );
    expect(tabs.map((t) => t.id)).toEqual(["b", "a", "c"]);
    expect(tabs[0]!.demo).toBe(true);
  });

  it("starts at 00:00 UTC and stays under the sample cap", () => {
    const { startMs, endMs } = windowBounds(Date.UTC(2026, 10, 9, 10, 29), WINDOWS[0]!);
    expect(startMs).toBe(Date.UTC(2026, 10, 9));
    expect(endMs - startMs).toBe(30 * 86_400_000);
    for (const w of WINDOWS) expect((w.days * 86_400) / w.stepS + 1).toBeLessThanOrEqual(10_000);
  });
});
