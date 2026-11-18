import type { components } from "@lunaris/shared-types";

/**
 * Types the lesson route reads. Lesson code never imports `lib/api/client` or `lib/api/queries`
 * (contract L3, decision D10); these are the same response shapes, taken from the generated
 * contract.
 */
export type SunDirectionSeries = components["schemas"]["SunDirectionSeries"];
export type Evidence = components["schemas"]["EvidenceSchema"];

export type TimelineAnalysis = components["schemas"]["TimelineAnalysis"];
export type HorizonMaskResponse = components["schemas"]["HorizonMaskResponse"];
export type SiteComparison = components["schemas"]["SiteComparison"];
export type ComparisonSummary = components["schemas"]["ComparisonSummary"];
export type Recommendation = components["schemas"]["Recommendation"];

export type MoonPhaseSeries = components["schemas"]["MoonPhaseSeries"];
export type MoonPhaseSample = components["schemas"]["MoonPhaseSample"];

/** Where the numbers on screen came from. A synthetic source is always labelled in the UI. */
export type PackProvenance =
  | { kind: "pack"; version: string; generatedAtUtc: string | null; codeCommit: string | null }
  | { kind: "synthetic"; reason: string };

export interface LessonPack {
  provenance: PackProvenance;
  sun: SunDirectionSeries;
  phase: MoonPhaseSeries;
}

/** The four packed comparison variants (manifest `comparisons[].variant`). */
export const COMPARE_VARIANTS = ["default", "power-critical", "comms-critical", "landing-critical"] as const;
export type CompareVariant = (typeof COMPARE_VARIANTS)[number];

/** The parts of `manifest.json` the lessons read. Everything else stays in the file. */
export interface PackIndex {
  lunation: { newMoonUtc: string; nextNewMoonUtc: string; startUtc: string; endUtc: string };
  demoTrio: Array<{
    catalogSiteId: string;
    name: string;
    horizonFile: string;
    timelineFile: string;
    terrainSunlitFraction: number;
  }>;
  comparisons: Array<{ variant: CompareVariant; file: string }>;
  /** The scan of the catalogue for a site with a 0 % sunlit fraction (none was found). */
  shadowed: {
    ran: boolean;
    permanentlyShadowedExample: string | null;
    criterion: string;
    windowStartUtc: string;
    windowEndUtc: string;
    sites: Array<{ catalogSiteId: string; sunlitFraction: number }>;
  };
  provenance: Extract<PackProvenance, { kind: "pack" }>;
}

/** One demo site as the step 4 screen needs it: its horizon mask and its timeline. */
export interface SiteBundle {
  catalogSiteId: string;
  name: string;
  horizon: HorizonMaskResponse;
  timeline: TimelineAnalysis;
}
