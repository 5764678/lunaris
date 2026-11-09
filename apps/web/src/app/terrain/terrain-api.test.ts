import { describe, expect, it } from "vitest";

import {
  isSiteTerrain,
  parseThreshold,
  terrainCells,
  terrainUrl,
  windowProvenance,
  type SiteTerrain,
} from "./terrain-api";

/** SYNTHETIC response (not lunar results). */
function terrain(overrides: Partial<SiteTerrain> = {}): SiteTerrain {
  return {
    site_id: "s1",
    latitude_deg: -89.45,
    longitude_deg: 222.69,
    height_m: 1955.01,
    scale_factor: 1.000023,
    slope_at_site: { slope_deg: 5.3, baseline_m: 40 },
    footprint: {
      radius_m: 100,
      cell_count: 79,
      missing_cell_count: 0,
      height_min_m: 1950.4,
      height_max_m: 1957.5,
      height_mean_m: 1954.4,
      slope_mean_deg: 3.43,
      slope_p95_deg: 6.61,
      slope_max_deg: null,
      slope_baseline_m: 40,
      roughness_rms_m: 1.35,
      roughness_baseline_m: 200,
    },
    hazard: null,
    dem: {
      dataset_id: "pgda-lola-20mpp-80s",
      title: "PGDA 20 m",
      url: "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF",
      etag: 'W/"abc"',
      last_modified: "Fri, 07 Jul 2023 22:28:19 GMT",
      resolution_m: 20,
      window_col_row_width_height: [100, 200, 18, 18],
      window_map_bounds_m: [0, 1, 0, 1],
      bytes_requested: 1234567,
      http_retries: 2,
      served_from_cache: true,
      read_at_utc: "2026-11-04T00:00:00+00:00",
      citation: "c",
    },
    evidence: { kind: "calculation", statement: "s", sources: [], method: "Horn", assumptions: [] },
    limitations: ["DEM resolution bounds what is detectable."],
    ...overrides,
  };
}

describe("terrain page data", () => {
  it("builds the request URL with optional thresholds only when set", () => {
    const base = { siteId: "a b", footprintRadiusM: 50, maxSlopeDeg: null, maxRoughnessM: null };
    expect(terrainUrl(base, "http://x")).toBe("http://x/api/v1/sites/a%20b/terrain?footprint_radius_m=50");
    expect(terrainUrl({ ...base, maxSlopeDeg: 10, maxRoughnessM: 0.5 }, "http://x")).toBe(
      "http://x/api/v1/sites/a%20b/terrain?footprint_radius_m=50&max_slope_deg=10&max_roughness_m=0.5",
    );
  });

  it("parses thresholds: empty is unset, nonsense is invalid", () => {
    expect(parseThreshold("")).toBeNull();
    expect(parseThreshold(" 12.5 ")).toBe(12.5);
    expect(parseThreshold("0")).toBe("invalid");
    expect(parseThreshold("abc")).toBe("invalid");
    expect(parseThreshold("95", 90)).toBe("invalid");
  });

  it("checks the response shape", () => {
    expect(isSiteTerrain(terrain())).toBe(true);
    expect(isSiteTerrain({ ...terrain(), footprint: null })).toBe(false);
    expect(isSiteTerrain({ site_id: "x" })).toBe(false);
  });

  it("turns values into cells with baselines, window provenance, and nulls with a reason", () => {
    const cells = terrainCells(terrain());
    expect(cells.slopeAtSite.baseline_m).toBe(40);
    expect(cells.roughness.baseline_m).toBe(200);
    expect(cells.height.baseline_m).toBeNull();
    expect(cells.slopeMax.value).toBeNull();
    expect(cells.slopeMax.reason).toBeTruthy();
    expect(cells.roughness.limitations.some((l) => l.includes("1,234,567 bytes"))).toBe(true);
    expect(windowProvenance(terrain()).join(" ")).toContain('ETag W/"abc"');
    expect(windowProvenance(terrain()).join(" ")).toContain("served from the local window cache");
  });
});
