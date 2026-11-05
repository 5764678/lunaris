import { describe, expect, it } from "vitest";

import { azElAt, directionAt, elevationAtMs, toDirectionSeries } from "./sun";

// SYNTHETIC samples: the direction rotates 90° about +Z between two epochs.
const T0 = Date.UTC(2026, 10, 5, 0);
const H = 3_600_000;
const sample = (h: number, dir: [number, number, number], el: number) => ({
  epoch_utc: new Date(T0 + h * H).toISOString(),
  azimuth_deg: 0,
  elevation_deg: el,
  range_m: 1.5e11,
  angular_radius_deg: 0.27,
  direction_moon_me: dir,
});
const series = toDirectionSeries([sample(0, [1, 0, 0], 1), sample(1, [0, 1, 0], 2)]);

describe("directionAt", () => {
  it("returns the samples at their epochs", () => {
    expect(directionAt(series, T0)).toEqual([1, 0, 0]);
    expect(directionAt(series, T0 + H)).toEqual([0, 1, 0]);
  });

  it("interpolates to a unit vector between samples", () => {
    const d = directionAt(series, T0 + H / 2)!;
    expect(Math.hypot(...d)).toBeCloseTo(1, 12);
    expect(d[0]).toBeCloseTo(Math.SQRT1_2, 12);
    expect(d[1]).toBeCloseTo(Math.SQRT1_2, 12);
  });

  it("never extrapolates", () => {
    expect(directionAt(series, T0 - 1)).toBeNull();
    expect(directionAt(series, T0 + H + 1)).toBeNull();
    expect(elevationAtMs(series, T0 + 2 * H)).toBeNull();
  });

  it("interpolates the elevation for the readout", () => {
    expect(elevationAtMs(series, T0 + H / 4)).toBeCloseTo(1.25, 12);
  });
});

describe("azElAt", () => {
  it("interpolates azimuth the short way across 0°/360°", () => {
    const wrap = toDirectionSeries([
      { ...sample(0, [1, 0, 0], 1), azimuth_deg: 350 },
      { ...sample(1, [1, 0, 0], 3), azimuth_deg: 10 },
    ]);
    const mid = azElAt(wrap, T0 + H / 2)!;
    expect(mid.azimuthDeg).toBeCloseTo(0, 9);
    expect(mid.elevationDeg).toBeCloseTo(2, 12);
    expect(azElAt(wrap, T0 + H / 4)!.azimuthDeg).toBeCloseTo(355, 9);
    expect(azElAt(wrap, T0 + 2 * H)).toBeNull();
  });
});
