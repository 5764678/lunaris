import type { Evidence } from "@lunaris/shared-types";
import { describe, expect, it } from "vitest";

import {
  SeriesError,
  elevationAt,
  elevationRange,
  parseUtc,
  seriesFromEphemeris,
  toElevationSeries,
  type BodyGeometrySample,
} from "./series";

// SYNTHETIC test fixture — invented numbers that exercise the adapter, not lunar geometry.
const EVIDENCE: Evidence = {
  kind: "model",
  statement: "SYNTHETIC test fixture.",
  sources: [],
  method: "test",
  assumptions: [],
};

function sample(epoch: string, elevation: number, radius = 0.27): BodyGeometrySample {
  return {
    epoch_utc: epoch,
    azimuth_deg: 10,
    elevation_deg: elevation,
    range_m: 1.5e11,
    angular_radius_deg: radius,
    direction_moon_me: [1, 0, 0],
  };
}

const SAMPLES = [
  sample("2026-11-04T00:00:00Z", -1),
  sample("2026-11-04T01:00:00Z", 1),
  sample("2026-11-04T02:00:00.500Z", 0.5),
];

describe("parseUtc", () => {
  it("accepts Z-suffixed ISO 8601 and rejects offsets or bare dates", () => {
    expect(parseUtc("2026-11-04T01:00:00Z")).toBe(Date.UTC(2026, 10, 4, 1));
    expect(() => parseUtc("2026-11-04T01:00:00+02:00")).toThrow(SeriesError);
    expect(() => parseUtc("2026-11-04")).toThrow(SeriesError);
  });
});

describe("toElevationSeries", () => {
  it("maps C2 samples to plot arrays", () => {
    const s = toElevationSeries("sun", SAMPLES, EVIDENCE);
    expect(s.epochsMs).toEqual([
      Date.UTC(2026, 10, 4, 0),
      Date.UTC(2026, 10, 4, 1),
      Date.UTC(2026, 10, 4, 2) + 500,
    ]);
    expect(s.elevationDeg).toEqual([-1, 1, 0.5]);
    expect(s.evidence.kind).toBe("model");
  });

  it.each([
    ["empty input", []],
    ["unsorted epochs", [SAMPLES[1]!, SAMPLES[0]!]],
    ["duplicate epochs", [SAMPLES[0]!, SAMPLES[0]!]],
    ["NaN elevation", [sample("2026-11-04T00:00:00Z", Number.NaN)]],
    ["elevation beyond 90°", [sample("2026-11-04T00:00:00Z", 91)]],
    ["zero angular radius", [sample("2026-11-04T00:00:00Z", 0, 0)]],
  ])("rejects %s", (_name, samples) => {
    expect(() => toElevationSeries("earth", samples, EVIDENCE)).toThrow(SeriesError);
  });
});

describe("elevationAt", () => {
  const s = toElevationSeries("sun", SAMPLES, EVIDENCE);

  it("returns samples exactly and interpolates linearly between them", () => {
    expect(elevationAt(s, Date.UTC(2026, 10, 4, 0))).toBe(-1);
    expect(elevationAt(s, Date.UTC(2026, 10, 4, 0, 30))).toBeCloseTo(0, 12);
    expect(elevationAt(s, s.epochsMs[2]!)).toBe(0.5);
  });

  it("never extrapolates", () => {
    expect(elevationAt(s, Date.UTC(2026, 10, 3, 23))).toBeNull();
    expect(elevationAt(s, Date.UTC(2026, 10, 4, 3))).toBeNull();
  });
});

describe("elevationRange", () => {
  it("is symmetric, includes the disk, and has a minimum span", () => {
    const s = toElevationSeries("sun", SAMPLES, EVIDENCE);
    const [lo, hi] = elevationRange(s);
    expect(lo).toBe(-hi);
    expect(hi).toBeCloseTo((1 + 0.27) * 1.1, 12);
    const flat = toElevationSeries("sun", [sample("2026-11-04T00:00:00Z", 0, 0.01)], EVIDENCE);
    expect(elevationRange(flat)).toEqual([-0.5, 0.5]);
  });
});

describe("seriesFromEphemeris", () => {
  it("maps each body with samples and keeps its evidence", () => {
    const ephemeris = {
      site_id: "s",
      bodies: [
        { body: "sun", evidence: EVIDENCE, samples: SAMPLES, body_radius_m: 6.96e8, body_radii_m: [] },
        {
          body: "earth",
          evidence: { ...EVIDENCE, kind: "model" },
          samples: [],
          body_radius_m: 6.4e6,
          body_radii_m: [],
        },
      ],
    } as unknown as Parameters<typeof seriesFromEphemeris>[0];
    const lanes = seriesFromEphemeris(ephemeris);
    expect(lanes.sun?.elevationDeg).toEqual([-1, 1, 0.5]);
    expect(lanes.earth).toBeUndefined();
  });
});
