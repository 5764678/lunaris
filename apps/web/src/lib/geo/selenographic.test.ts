import { describe, expect, it } from "vitest";

import {
  formatLatitude,
  formatLongitude,
  normalizeEastLongitude,
  sceneToSelenographic,
  selenographicToScene,
  validateCoordinateInput,
  type Vec3,
} from "./selenographic";

function expectVec(actual: Vec3, expected: Vec3) {
  actual.forEach((value, i) => expect(value).toBeCloseTo(expected[i] ?? NaN, 12));
}

describe("normalizeEastLongitude", () => {
  it.each([
    [0, 0],
    [-0, 0],
    [360, 0],
    [-90, 270],
    [-180, 180],
    [450.5, 90.5],
  ])("%d → %d", (input, expected) => {
    const result = normalizeEastLongitude(input);
    expect(result).toBeCloseTo(expected, 12);
    expect(Object.is(result, -0)).toBe(false);
  });

  it("rejects non-finite values", () => {
    expect(() => normalizeEastLongitude(Number.NaN)).toThrow(RangeError);
  });
});

describe("selenographicToScene (MOON_ME → Y-up scene)", () => {
  it("places the prime meridian on +X", () => expectVec(selenographicToScene(0, 0), [1, 0, 0]));
  it("places 90°E on −Z", () => expectVec(selenographicToScene(0, 90), [0, 0, -1]));
  it("places the north pole on +Y", () => expectVec(selenographicToScene(90, 0), [0, 1, 0]));
  it("places the south pole on −Y", () => expectVec(selenographicToScene(-90, 77), [0, -1, 0]));
  it("scales by radius", () => expectVec(selenographicToScene(0, 180, 2), [-2, 0, 0]));

  it("shows east on the right when viewed from Earth with north up", () => {
    // Camera on +X looking at the origin, up = +Y → right vector = forward × up = (0,0,-1).
    const east = selenographicToScene(0, 10);
    const west = selenographicToScene(0, 350);
    const right: Vec3 = [0, 0, -1];
    const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    expect(dot(east, right)).toBeGreaterThan(0);
    expect(dot(west, right)).toBeLessThan(0);
  });

  it("round-trips through sceneToSelenographic", () => {
    for (const [lat, lon] of [
      [-89.45, 222.69],
      [12.5, 0.001],
      [-30, 359.9],
    ] as const) {
      const back = sceneToSelenographic(selenographicToScene(lat, lon, 1.3));
      expect(back.latitudeDeg).toBeCloseTo(lat, 10);
      expect(back.longitudeDeg).toBeCloseTo(lon, 10);
    }
  });
});

describe("formatting", () => {
  it("formats hemispheres and east longitude", () => {
    expect(formatLatitude(-89.45)).toBe("89.450°S");
    expect(formatLatitude(12.3456, 2)).toBe("12.35°N");
    expect(formatLongitude(-137.31)).toBe("222.690°E");
    expect(formatLongitude(359.9996)).toBe("0.000°E");
    expect(formatLongitude(-0.001, 2)).toBe("0.00°E");
  });
});

describe("validateCoordinateInput", () => {
  it("accepts valid input", () => expect(validateCoordinateInput("-89.5", "-45")).toEqual({}));
  it("flags out-of-range and non-numeric input", () => {
    expect(validateCoordinateInput("91", "0").latitude).toBeDefined();
    expect(validateCoordinateInput("0", "361").longitude).toBeDefined();
    expect(validateCoordinateInput("", "abc")).toEqual({
      latitude: "Enter a number.",
      longitude: "Enter a number.",
    });
  });
});
