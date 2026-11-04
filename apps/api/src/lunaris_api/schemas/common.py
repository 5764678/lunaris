"""Wire-level building blocks shared by several endpoints.

Naming conventions (see docs/API.md): snake_case fields, units as suffixes
(``_deg``, ``_m``, ``_s``, ``_bytes``), timestamps as ISO 8601 UTC (``_utc``).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

EvidenceKindLiteral = Literal[
    "observation", "derived_product", "model", "calculation", "assumption", "placeholder"
]


class Schema(BaseModel):
    """Base for response schemas.

    Fields with defaults are always serialized, so the OpenAPI (serialization-mode)
    schema marks them required; generated client types then match real responses.
    """

    model_config = ConfigDict(frozen=True, json_schema_serialization_defaults_required=True)


class SourceReferenceSchema(Schema):
    source_id: str
    title: str
    url: str | None = None
    version: str | None = None
    sha256: str | None = None
    citation: str | None = None


class EvidenceSchema(Schema):
    """What kind of knowledge a value is, and where it comes from."""

    kind: EvidenceKindLiteral
    statement: str
    sources: list[SourceReferenceSchema] = Field(default_factory=list)
    method: str | None = None
    assumptions: list[str] = Field(default_factory=list)


class ErrorDetail(Schema):
    location: list[str | int] = Field(
        default_factory=list, description="Path to the offending input, e.g. ['body', 'name']."
    )
    message: str
    type: str


class ErrorBody(Schema):
    code: str = Field(description="Stable machine-readable error code.")
    message: str = Field(description="Human-readable summary.")
    details: list[ErrorDetail] = Field(default_factory=list)
    request_id: str | None = None


class ErrorResponse(Schema):
    """Envelope returned for every non-2xx response."""

    error: ErrorBody


ResponseDocs = dict[int | str, dict[str, object]]

SERVER_ERROR: ResponseDocs = {
    500: {"model": ErrorResponse, "description": "Unexpected server error."},
}
VALIDATION_ERROR: ResponseDocs = {
    422: {"model": ErrorResponse, "description": "Request validation failed."},
}
ERROR_RESPONSES: ResponseDocs = {**VALIDATION_ERROR, **SERVER_ERROR}
"""For routes that accept input (path, query or body)."""

__all__ = [
    "ERROR_RESPONSES",
    "SERVER_ERROR",
    "VALIDATION_ERROR",
    "ErrorBody",
    "ErrorDetail",
    "ErrorResponse",
    "EvidenceKindLiteral",
    "EvidenceSchema",
    "ResponseDocs",
    "Schema",
    "SourceReferenceSchema",
]
