/**
 * Illumination results (contract C4), served by `POST /api/v1/analysis/timeline`.
 *
 * These are aliases of the generated OpenAPI types: the Pydantic schemas in
 * `apps/api/src/lunaris_api/schemas/illumination.py` are the single source of truth.
 * Definitions of every summary statistic: docs/SCIENCE.md §5.3.
 */
import type { components } from "./generated/lunaris-api";

type Schemas = components["schemas"];

/** Which horizon a summary is computed against. Both are always reported separately. */
export type HorizonKind = Schemas["IlluminationSummary"]["horizon"];

/** Solar geometry and visible disk fractions at one epoch. */
export type SolarGeometrySample = Schemas["SolarGeometrySample"];

/**
 * Summary against one horizon. `mean_visible_disk_fraction` (time average of the disk
 * fraction) is the quantity comparable to published polar illumination studies;
 * `illuminated_fraction` is the share of samples with any part of the disk visible.
 */
export type IlluminationSummary = Schemas["IlluminationSummary"];

/** Illumination time series and summaries for one site; `terrain` is null without a mask. */
export type IlluminationResult = Schemas["IlluminationResult"];

/** Request and response of the timeline analysis endpoint. */
export type TimelineRequest = Schemas["TimelineRequest"];
export type TimelineAnalysis = Schemas["TimelineAnalysis"];
