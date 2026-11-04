/**
 * Types of the implemented HTTP API, derived from the generated OpenAPI contract
 * (`src/generated/lunaris-api.ts`). Never edit the generated file; change the Pydantic
 * schemas in apps/api and run `npm run contracts:generate`.
 */
import type { components, operations, paths } from "./generated/lunaris-api";

type Schemas = components["schemas"];

export type { components, operations, paths };

// ── Health & system ─────────────────────────────────────────────────────────
export type HealthResponse = Schemas["HealthResponse"];
export type ComponentCheck = Schemas["ComponentCheck"];
export type RuntimeReport = Schemas["RuntimeReport"];
export type RuntimeComponent = Schemas["RuntimeComponentSchema"];

// ── Errors ──────────────────────────────────────────────────────────────────
export type ErrorResponse = Schemas["ErrorResponse"];
export type ErrorBody = Schemas["ErrorBody"];
export type ErrorDetail = Schemas["ErrorDetail"];

// ── Provenance ──────────────────────────────────────────────────────────────
export type Evidence = Schemas["EvidenceSchema"];
export type SourceReference = Schemas["SourceReferenceSchema"];
export type EvidenceKind = Evidence["kind"];

// ── Datasets ────────────────────────────────────────────────────────────────
export type DatasetListResponse = Schemas["DatasetListResponse"];
export type DatasetSummary = Schemas["DatasetSummary"];
export type DatasetFile = Schemas["DatasetFileSchema"];
export type DatasetLocalState = Schemas["DatasetLocalSchema"];
export type DatasetStatus = DatasetLocalState["status"];
export type DatasetCategory = DatasetSummary["category"];
export type SpatialMetadata = Schemas["SpatialMetadataSchema"];
export type UrlVerification = Schemas["UrlVerificationSchema"];

// ── Candidate sites ─────────────────────────────────────────────────────────
export type CandidateSite = Schemas["CandidateSite"];
export type CandidateSiteCreate = Schemas["CandidateSiteCreate"];
export type CandidateSiteList = Schemas["CandidateSiteList"];
export type BodyFixedPosition = Schemas["BodyFixedPositionSchema"];
export type SelenographicCoordinate = Schemas["SelenographicCoordinateSchema"];

/** Major version of the HTTP contract this package was generated against. */
export const API_CONTRACT_VERSION = "v1" as const;
