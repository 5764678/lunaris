import type { IsoUtcTimestamp } from "./conventions";
import type { Evidence } from "./api";
import type { EarthVisibilityResult } from "./visibility";
import type { IlluminationResult } from "./illumination";
import type { MissionConfiguration, MissionConstraint, MissionMetric } from "./mission";
import type { SoftwareProvenance } from "./provenance";
import type { TerrainAnalysisResult } from "./terrain";

/**
 * Outcome of evaluating a mission configuration across its candidate sites.
 *
 * @status draft — contract for Milestone 05.
 */
export interface MissionAnalysisResult {
  mission: MissionConfiguration;
  computed_at_utc: IsoUtcTimestamp;
  sites: SiteAssessment[];
  /** Site ids of eligible sites, best first. Excluded sites never appear here. */
  ranking: string[];
  software: SoftwareProvenance;
  /** Global caveats, e.g. "preliminary planning tool — not a certified landing system". */
  disclaimers: string[];
}

export interface SiteAssessment {
  site_id: string;
  eligibility: "eligible" | "excluded" | "insufficient_data";
  violated_constraints: ConstraintEvaluation[];
  /** Weighted score in [0, 1]; null when excluded or data are insufficient. */
  score: number | null;
  score_breakdown: ScoreContribution[];
  terrain: TerrainAnalysisResult | null;
  illumination: IlluminationResult | null;
  earth_visibility: EarthVisibilityResult | null;
}

export interface ConstraintEvaluation {
  constraint: MissionConstraint;
  observed_value: number;
  satisfied: boolean;
  evidence: Evidence;
}

export interface ScoreContribution {
  metric: MissionMetric;
  raw_value: number;
  normalized_value: number;
  weight: number;
  contribution: number;
  explanation: string;
}
