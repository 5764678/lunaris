import type { components } from "@lunaris/shared-types";

/**
 * Types the lesson route reads. Lesson code never imports `lib/api/client` or `lib/api/queries`
 * (contract L3, decision D10); these are the same response shapes, taken from the generated
 * contract.
 */
export type SunDirectionSeries = components["schemas"]["SunDirectionSeries"];
export type Evidence = components["schemas"]["EvidenceSchema"];
export type TimelineAnalysis = components["schemas"]["TimelineAnalysis"];
export type HorizonMask = components["schemas"]["HorizonMaskResponse"];
export type SiteComparison = components["schemas"]["SiteComparison"];
export type CompareCell = components["schemas"]["CompareCell"];
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

/** The parts of `manifest.json` the lesson reads (contract L2). */
export interface PackManifest {
  pack_version?: string;
  lunation: {
    name: string;
    new_moon_utc: string;
    next_new_moon_utc: string;
    window: { start_utc: string; end_utc: string; step_s: number };
  };
  demo_trio: { catalog_site_id: string; name: string; files: string[]; terrain_sunlit_fraction: number }[];
  comparisons: {
    variant: string;
    mission_answers: Record<string, string>;
    file: string;
  }[];
  shadowed_scan: {
    ran: boolean;
    window: { start_utc: string; end_utc: string; step_s: number };
    criterion: string;
    sites: { catalog_site_id: string; sunlit_fraction: number }[];
  };
}

export interface LessonSite {
  name: string;
  catalogSiteId: string;
  horizon: HorizonMask;
  timeline: TimelineAnalysis;
}
