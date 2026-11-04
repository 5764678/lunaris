/**
 * @lunaris/shared-types — domain and API contract types for LUNARIS.
 *
 * Two kinds of types live here:
 * 1. **Implemented contracts** (./api) derived from the backend's OpenAPI document.
 *    They cannot drift: CI regenerates and compares them.
 * 2. **Draft contracts** (marked `@status draft`) for modules that are not implemented
 *    yet. They document intended shapes, units and provenance requirements and are not
 *    served by the API.
 */
export * from "./api";
export * from "./conventions";
export type { LocalDirection, SurfacePoint } from "./coordinates";
export type { DatasetFileProvenance, DatasetProvenance, SoftwareProvenance } from "./provenance";
export type { SiteOrigin } from "./sites";
export type * from "./mission";
export type * from "./terrain";
export type * from "./illumination";
export type * from "./visibility";
export type * from "./analysis";
