import { describe, expect, it } from "vitest";

import { missionParams } from "@/lib/api/client";

import { clampLimit, DEFAULT_MISSION, isDefaultMission, parseLimit, points } from "./mission";

describe("mission answers", () => {
  it("sends nothing for the default mission", () => {
    expect(missionParams(DEFAULT_MISSION)).toEqual({});
    expect(isDefaultMission(DEFAULT_MISSION)).toBe(true);
  });

  it("sends only what was answered, with the API's parameter names", () => {
    const mission = { ...DEFAULT_MISSION, power: "high" as const, comms: "none" as const, maxSlopeDeg: 5 };
    expect(missionParams(mission)).toEqual({ power: "high", comms: "none", max_slope_deg: "5" });
    expect(isDefaultMission(mission)).toBe(false);
  });

  it("parses a typed limit as a positive number, else no limit", () => {
    expect(parseLimit("7")).toBe(7);
    expect(parseLimit("7,5")).toBe(7.5);
    expect(parseLimit("")).toBeNull();
    expect(parseLimit("  ")).toBeNull();
    expect(parseLimit("abc")).toBeNull();
    expect(parseLimit("0")).toBeNull();
    expect(parseLimit("-3")).toBeNull();
    expect(parseLimit(null)).toBeNull();
  });

  it("caps a slope limit at 90°", () => {
    expect(clampLimit("maxSlopeDeg", 120)).toBe(90);
    expect(clampLimit("maxDarknessD", 120)).toBe(120);
    expect(clampLimit("maxSlopeDeg", null)).toBeNull();
  });

  it("shows scores as points out of 100", () => {
    expect(points(0.7134)).toBe("71.3");
    expect(points(null)).toBe("–");
  });
});
