import { describe, expect, it } from "vitest";

import { MILESTONES, isMilestoneId, milestoneLabel } from "./milestones";
import { MISSION_MODULES } from "./modules";

describe("milestone names", () => {
  it("labels a milestone with its roadmap name", () => {
    expect(milestoneLabel("M04")).toBe("Milestone M04: Illumination and Earth visibility");
    expect(milestoneLabel("M05")).toBe("Milestone M05: Mission intelligence");
  });

  it("falls back to the bare id for one that is not listed, and ignores inherited object keys", () => {
    expect(milestoneLabel("M99")).toBe("M99");
    expect(isMilestoneId("toString")).toBe(false);
    expect(milestoneLabel("toString")).toBe("toString");
  });
});

describe("module list", () => {
  it("gives every module a unique id", () => {
    const ids = MISSION_MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("names a listed milestone for every module, so a label cannot drift from the roadmap names", () => {
    for (const entry of MISSION_MODULES) {
      expect(isMilestoneId(entry.milestone), `${entry.id} uses ${entry.milestone}`).toBe(true);
    }
    expect(Object.keys(MILESTONES)).toContain("M01");
  });
});
