import { describe, expect, it } from "vitest";

import {
  DAY_MS,
  HOUR_MS,
  MINUTE_MS,
  dayOfYearUtc,
  dayTicks,
  formatOffset,
  formatUtc,
  toIsoUtc,
} from "./time";

const T0 = Date.UTC(2026, 10, 4, 9, 30, 12, 345); // 2026-11-04T09:30:12.345Z

describe("UTC formatting", () => {
  it("formats in UTC regardless of the local time zone", () => {
    expect(formatUtc(T0)).toBe("2026-11-04 09:30:12");
    expect(formatUtc(T0, false)).toBe("2026-11-04 09:30");
    expect(toIsoUtc(T0)).toBe("2026-11-04T09:30:12Z");
  });

  it("computes day of year", () => {
    expect(dayOfYearUtc(Date.UTC(2026, 0, 1))).toBe(1);
    expect(dayOfYearUtc(T0)).toBe(308);
  });
});

describe("formatOffset", () => {
  it.each([
    [0, "+0s"],
    [45 * 1000, "+45s"],
    [-(5 * MINUTE_MS + 3000), "−5m 03s"],
    [2 * HOUR_MS + 7 * MINUTE_MS, "+2h 07m"],
    [2 * DAY_MS + 3 * HOUR_MS + 15 * MINUTE_MS, "+2d 03h 15m"],
  ])("%d ms → %s", (ms, expected) => expect(formatOffset(ms)).toBe(expected));
});

describe("dayTicks", () => {
  it("places UTC-midnight ticks proportionally within the window", () => {
    const ticks = dayTicks(T0, T0 + 30 * DAY_MS);
    expect(ticks).toHaveLength(30);
    expect(ticks[0]?.ms).toBe(Date.UTC(2026, 10, 5));
    expect(ticks[0]?.major).toBe(true);
    expect(ticks[0]?.label).toBe("11-05");
    expect(ticks[1]?.label).toBe("");
    for (const tick of ticks) {
      expect(tick.position).toBeGreaterThan(0);
      expect(tick.position).toBeLessThanOrEqual(1);
    }
  });

  it("returns nothing for an empty window", () => {
    expect(dayTicks(T0, T0)).toEqual([]);
  });
});
