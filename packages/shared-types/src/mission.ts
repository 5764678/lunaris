import type { IsoUtcTimestamp, TimeWindow } from "./conventions";

/**
 * Configuration of a mission analysis: which sites, which time window, which
 * constraints and how candidates are scored.
 *
 * @status draft — contract for Milestone 05. Not yet accepted by the API.
 */
export interface MissionConfiguration {
  id: string;
  name: string;
  description: string | null;
  analysis_window: TimeWindow;
  /** Sampling step of time series, seconds. */
  time_step_s: number;
  site_ids: string[];
  constraints: MissionConstraint[];
  scoring: ScoringCriterion[];
  created_at_utc: IsoUtcTimestamp;
  updated_at_utc: IsoUtcTimestamp;
}

/** Metrics that constraints and scoring criteria can refer to. Units are fixed per metric. */
export type MissionMetric =
  | "slope_deg" // terrain slope over the stated baseline (M02)
  | "roughness_m" // terrain roughness statistic (M02)
  | "sun_visibility_fraction" // fraction of the window with the Sun above the terrain horizon (M04)
  | "longest_darkness_s" // longest continuous period without direct sunlight (M04)
  | "earth_visibility_fraction" // fraction of the window with geometric Earth line of sight (M04)
  | "longest_earth_outage_s"; // longest continuous period without Earth line of sight (M04)

export type ComparisonOperator = "<=" | ">=";

/**
 * A hard operational constraint. A site that violates any hard constraint is reported
 * as excluded — never silently down-weighted.
 */
export interface MissionConstraint {
  id: string;
  metric: MissionMetric;
  operator: ComparisonOperator;
  threshold: number;
  /** Must equal the unit implied by `metric`. */
  unit: string;
  rationale: string;
}

/** A weighted, user-visible scoring criterion (an explicit assumption of the analysis). */
export interface ScoringCriterion {
  metric: MissionMetric;
  direction: "maximize" | "minimize";
  /** Relative weight, > 0. Weights are normalized to sum to 1 at evaluation time. */
  weight: number;
  normalization: { method: "min_max_across_sites" } | { method: "fixed_range"; min: number; max: number };
}
