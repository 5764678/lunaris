import type { IsoUtcTimestamp, ScalarStatistic } from "./conventions";
import type { Evidence } from "./api";
import type { SurfacePoint } from "./coordinates";
import type { DatasetProvenance, SoftwareProvenance } from "./provenance";

/**
 * Terrain assessment of a candidate site from a LOLA DEM.
 *
 * @status draft — contract for Milestone 02. Every statistic states its unit, the DEM it
 * was computed from (with resolution) and the analysis footprint.
 */
export interface TerrainAnalysisResult {
  site_id: string;
  /** Site position with height sampled from the DEM. */
  location: SurfacePoint;
  dem: DatasetProvenance;
  /** Radius of the circular analysis footprint around the site, metres. */
  footprint_radius_m: number;
  /** Ground sampling distance of the DEM at the site after projection scale correction. */
  effective_resolution_m: number;
  elevation_m: ScalarStatistic;
  slope_deg: TerrainStatistic;
  roughness_m: TerrainStatistic;
  hazard: TerrainHazardAssessment;
  evidence: Evidence;
  computed_at_utc: IsoUtcTimestamp;
  software: SoftwareProvenance;
}

/** A terrain statistic together with the method and baseline it was computed with. */
export interface TerrainStatistic extends ScalarStatistic {
  method: string;
  /** Horizontal baseline the derivative or deviation is computed over, metres. */
  baseline_m: number;
}

/**
 * Threshold-based hazard classification. Thresholds are configuration (assumptions),
 * returned with the result so the classification can be audited.
 */
export interface TerrainHazardAssessment {
  classification: "nominal" | "caution" | "hazardous" | "insufficient_data";
  max_slope_threshold_deg: number;
  /** Fraction of the footprint whose slope exceeds the threshold, [0, 1]. */
  area_above_threshold_fraction: number;
  notes: string[];
}
