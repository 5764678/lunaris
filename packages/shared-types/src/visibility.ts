/**
 * Earth-visibility results (contract C4), served by `POST /api/v1/analysis/timeline`.
 *
 * Aliases of the generated OpenAPI types; the Pydantic schemas in
 * `apps/api/src/lunaris_api/schemas/visibility.py` are the single source of truth.
 *
 * IMPORTANT: geometric visibility is a necessary, not a sufficient, condition for
 * direct-to-Earth radio communication. Link budget, antenna pointing, ground-station
 * availability and multipath are NOT modelled. Every result's `limitations` says so.
 */
import type { components } from "./generated/lunaris-api";

type Schemas = components["schemas"];

/**
 * - `clear`: part of the Earth's disk is above the horizon used (terrain when a mask
 *   exists). From a peak this can happen with the disk below 0°.
 * - `terrain_obstructed`: above the astronomical horizon, hidden by terrain.
 * - `below_geometric_horizon`: above neither horizon.
 */
export type EarthLineOfSight = Schemas["EarthGeometrySample"]["line_of_sight"];

export type EarthGeometrySample = Schemas["EarthGeometrySample"];

/** A maximal run of samples; edges known to ± `resolution_s`; censored at window edges. */
export type VisibilityWindow = Schemas["VisibilityWindow"];

export type EarthVisibilitySummary = Schemas["EarthVisibilitySummary"];

/** Earth-visibility time series and summaries for one site; `terrain` is null without a mask. */
export type EarthVisibilityResult = Schemas["EarthVisibilityResult"];
