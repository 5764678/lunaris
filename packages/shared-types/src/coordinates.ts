import type { LunarFrame } from "./conventions";

export type { SelenographicCoordinate, BodyFixedPosition } from "./api";

/**
 * A surface point with an explicitly sampled height.
 *
 * @status draft — produced by terrain sampling (Milestone 02). Heights are relative to
 * the reference sphere named in `reference_radius_m`; `null` means "not sampled",
 * which is deliberately distinct from 0.
 */
export interface SurfacePoint {
  latitude_deg: number;
  longitude_deg: number;
  height_m: number | null;
  reference_radius_m: number;
  frame: LunarFrame;
}

/** Direction in the local topocentric frame of a surface point (see conventions). */
export interface LocalDirection {
  /** Clockwise from local north, degrees, [0, 360). */
  azimuth_deg: number;
  /** Above the local horizontal plane of the reference sphere, degrees, [-90, 90]. */
  elevation_deg: number;
}
