from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import AwareDatetime, Field

from lunaris_api.schemas.common import EvidenceKindLiteral, Schema

DatasetStatusLiteral = Literal["missing", "incomplete", "untracked", "acquired"]


class SpatialMetadataSchema(Schema):
    body: Literal["Moon"]
    frame: str | None = None
    projection: str | None = None
    nominal_resolution_m: float | None = None
    coverage: str | None = None
    vertical_reference: str | None = None


class UrlVerificationSchema(Schema):
    status: Literal["unverified", "verified"]
    checked_on: date | None = Field(default=None, description="Date the URLs were last confirmed.")
    note: str


class DatasetFileSchema(Schema):
    name: str
    role: Literal["data", "label", "kernel", "visual", "documentation"]
    url: str
    present: bool
    size_bytes: int | None = Field(
        default=None, description="Size on disk if present, else the size pinned in the manifest."
    )
    sha256: str | None = Field(
        default=None, description="SHA-256 from the acquisition record, else the pinned value."
    )


class DatasetLocalSchema(Schema):
    status: DatasetStatusLiteral
    files_present: int
    files_expected: int
    bytes_on_disk: int
    acquired_at_utc: AwareDatetime | None = None
    manifest_changed: bool = Field(
        description="True if the manifest was edited after this dataset was acquired."
    )


class DatasetSummary(Schema):
    id: str
    title: str
    summary: str
    category: Literal["terrain", "ephemeris", "imagery", "visualization"]
    evidence_kind: EvidenceKindLiteral
    provider: str
    mission: str | None = None
    instrument: str | None = None
    product_family: str | None = None
    source_page: str
    spatial: SpatialMetadataSchema | None = None
    units: str | None = None
    citation: str
    usage: str
    url_verification: UrlVerificationSchema
    required_by: list[str]
    notes: list[str]
    files: list[DatasetFileSchema]
    local: DatasetLocalSchema
    acquire_command: str


class DatasetListResponse(Schema):
    datasets: list[DatasetSummary]
    count: int


__all__ = [
    "DatasetFileSchema",
    "DatasetListResponse",
    "DatasetLocalSchema",
    "DatasetStatusLiteral",
    "DatasetSummary",
    "SpatialMetadataSchema",
    "UrlVerificationSchema",
]
