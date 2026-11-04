import type { IsoUtcTimestamp, TimeWindow } from "./conventions";
import type { Evidence } from "./api";
import type { DatasetProvenance, SoftwareProvenance } from "./provenance";

/**
 * Geometric line-of-sight state to the Earth's centre.
 *
 * IMPORTANT: geometric visibility is a necessary, not a sufficient, condition for
 * direct-to-Earth radio communication. Link budget, antenna pointing, ground-station
 * availability and multipath are NOT modelled.
 */
export type EarthLineOfSight = "clear" | "terrain_obstructed" | "below_geometric_horizon";

/** @status draft — contract for Milestones 03/04. */
export interface EarthGeometrySample {
  epoch_utc: IsoUtcTimestamp;
  azimuth_deg: number;
  elevation_deg: number;
  /** Apparent angular radius of the Earth, degrees. */
  earth_radius_deg: number;
  horizon_elevation_deg: number | null;
  line_of_sight: EarthLineOfSight;
}

export interface VisibilityWindow {
  start_utc: IsoUtcTimestamp;
  end_utc: IsoUtcTimestamp;
  duration_s: number;
}

/** @status draft — contract for Milestone 04. */
export interface EarthVisibilityResult {
  site_id: string;
  model: "geometric" | "terrain_horizon";
  window: TimeWindow;
  time_step_s: number;
  samples: EarthGeometrySample[];
  /** Direct-to-Earth geometric visibility windows. */
  windows: VisibilityWindow[];
  summary: {
    visible_fraction: number;
    longest_outage_s: number;
  };
  ephemeris: DatasetProvenance;
  dem: DatasetProvenance | null;
  evidence: Evidence;
  /** Always includes the statement that geometric visibility does not imply a radio link. */
  limitations: string[];
  computed_at_utc: IsoUtcTimestamp;
  software: SoftwareProvenance;
}
