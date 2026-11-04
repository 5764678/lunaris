import type { IsoUtcTimestamp, TimeWindow } from "./conventions";
import type { Evidence } from "./api";
import type { DatasetProvenance, SoftwareProvenance } from "./provenance";

/**
 * Illumination model used for a result.
 * - `geometric`: Sun above the local horizontal plane of the reference sphere.
 * - `terrain_horizon`: Sun above the terrain horizon derived from a DEM, accounting for
 *   the finite solar disk.
 */
export type IlluminationModel = "geometric" | "terrain_horizon";

/**
 * Solar geometry at one epoch as seen from a site.
 *
 * @status draft — contract for Milestones 03/04.
 */
export interface SolarGeometrySample {
  epoch_utc: IsoUtcTimestamp;
  azimuth_deg: number;
  elevation_deg: number;
  /** Apparent angular radius of the solar disk, degrees. */
  solar_radius_deg: number;
  /** Terrain horizon elevation at the solar azimuth, degrees (terrain model only). */
  horizon_elevation_deg: number | null;
  /** Fraction of the solar disk above the horizon, [0, 1]. */
  visible_disk_fraction: number;
}

/**
 * Illumination time series and summary for one site over a window.
 *
 * @status draft — contract for Milestone 04.
 */
export interface IlluminationResult {
  site_id: string;
  model: IlluminationModel;
  window: TimeWindow;
  time_step_s: number;
  samples: SolarGeometrySample[];
  summary: {
    /** Fraction of samples with any part of the solar disk visible, [0, 1]. */
    illuminated_fraction: number;
    longest_darkness_s: number;
    longest_illumination_s: number;
  };
  ephemeris: DatasetProvenance;
  /** Present for `terrain_horizon` results. */
  dem: DatasetProvenance | null;
  evidence: Evidence;
  limitations: string[];
  computed_at_utc: IsoUtcTimestamp;
  software: SoftwareProvenance;
}
