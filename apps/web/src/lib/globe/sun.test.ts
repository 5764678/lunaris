import { describe, expect, it } from "vitest";

import type { SunDirectionSeries } from "@/lib/api/client";

import { globeSunAt, toGlobeSunSeries } from "./sun";

// SYNTHETIC samples: the Sun crosses 0° E between two hourly samples.
const T0 = Date.UTC(2026, 10, 9, 0);
const H = 3_600_000;
const sample = (h: number, dir: number[], lat: number, lon: number) => ({
  epoch_utc: new Date(T0 + h * H).toISOString(),
  direction_moon_me: dir,
  subsolar_latitude_deg: lat,
  subsolar_longitude_deg: lon,
  range_m: 1.5e11,
  angular_radius_deg: 0.27,
});
const series = toGlobeSunSeries({
  samples: [
    sample(0, [Math.cos(-0.1), Math.sin(-0.1), 0], 1, 359.5),
    sample(1, [Math.cos(0.1), Math.sin(0.1), 0], 1.2, 0.5),
  ],
} as unknown as SunDirectionSeries);

describe("globeSunAt", () => {
  it("interpolates the direction to a unit vector and the sub-solar point across 0°/360°", () => {
    const sun = globeSunAt(series, T0 + H / 2)!;
    expect(Math.hypot(...sun.direction)).toBeCloseTo(1, 12);
    expect(sun.direction[0]).toBeCloseTo(1, 9);
    expect(sun.subsolarLonDeg).toBeCloseTo(0, 9);
    expect(sun.subsolarLatDeg).toBeCloseTo(1.1, 12);
    expect(globeSunAt(series, T0 + H / 4)!.subsolarLonDeg).toBeCloseTo(359.75, 9);
  });

  it("never extrapolates", () => {
    expect(globeSunAt(series, T0 - 1)).toBeNull();
    expect(globeSunAt(series, T0 + H + 1)).toBeNull();
  });
});
