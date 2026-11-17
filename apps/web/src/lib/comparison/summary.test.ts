import { describe, expect, it } from "vitest";

import type { ComparisonSummary } from "@/lib/api/client";

import type { CompareColumn } from "./progress";
import { directionNote, leaderLabel, leadersByColumn } from "./summary";

const col = (key: string, label: string, better: CompareColumn["better"] = null): CompareColumn => ({
  key,
  label,
  unit: "m",
  description: label,
  better,
  better_rationale: "",
});

const summary = (leaders: ComparisonSummary["leaders"]): ComparisonSummary => ({
  leaders,
  sites: [],
  verdict: "",
  method: "",
  recommendation: {
    mission: { power: "medium", comms: "medium", landing: "medium", limits: {} },
    site_id: null,
    name: null,
    confidence: "none",
    headline: "",
    reasons: [],
    tradeoffs: [],
    caveats: [],
    needs: [],
    scales: [],
    ranking: [],
    method: "",
    evidence: { kind: "assumption", statement: "", sources: [], assumptions: [] },
  } as unknown as ComparisonSummary["recommendation"],
});

describe("comparison summary helpers", () => {
  it("lists leaders only where two or more sites have a value, and marks ties", () => {
    const map = leadersByColumn(
      summary([
        { key: "a", better: "lower", site_ids: ["s1"], value: 1, compared_sites: 3 },
        { key: "b", better: "higher", site_ids: ["s1", "s2"], value: 2, compared_sites: 2 },
        { key: "c", better: "higher", site_ids: [], value: null, compared_sites: 0 },
        { key: "d", better: "higher", site_ids: ["s3"], value: 5, compared_sites: 1 },
      ]),
    );
    expect([...map.keys()]).toEqual(["a", "b"]);
    expect(map.get("a")).toEqual({ siteIds: new Set(["s1"]), tied: false });
    expect(map.get("b")?.tied).toBe(true);
    expect(leadersByColumn(null).size).toBe(0);
  });

  it("labels keys with the page's wording and falls back to the key", () => {
    const columns = [col("roughness_rms_m", "Roughness")];
    expect(leaderLabel("roughness_rms_m", columns)).toBe("Bumpiness");
    expect(leaderLabel("unknown_key", columns)).toBe("unknown_key");
  });

  it("states the ranking direction, or that a column is not ranked", () => {
    expect(directionNote({ better: "higher" })).toBe("↑ higher is better");
    expect(directionNote({ better: "lower" })).toBe("↓ lower is better");
    expect(directionNote({ better: null })).toBe("not ranked");
  });
});
