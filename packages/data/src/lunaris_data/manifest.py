"""Dataset manifest schema.

A manifest is the version-controlled description of one external dataset: where it
comes from, what it is, how it is cited, its spatial reference and resolution, and
whether its download URLs have been verified. Manifests describe data; they never
contain data values.
"""

from __future__ import annotations

import hashlib
from datetime import date
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator

from lunaris_science.provenance import EvidenceKind

DatasetId = Annotated[str, Field(pattern=r"^[a-z0-9][a-z0-9-]{2,63}$")]
FileName = Annotated[str, Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")]
Sha256Hex = Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]


class DatasetCategory(StrEnum):
    TERRAIN = "terrain"
    EPHEMERIS = "ephemeris"
    IMAGERY = "imagery"
    VISUALIZATION = "visualization"


class StorageArea(StrEnum):
    """Top-level directory of the local data store that holds the dataset."""

    RAW = "raw"
    KERNELS = "kernels"


class FileRole(StrEnum):
    DATA = "data"
    LABEL = "label"
    KERNEL = "kernel"
    VISUAL = "visual"
    DOCUMENTATION = "documentation"


class UrlVerificationStatus(StrEnum):
    """Whether the manifest's download URLs have been confirmed against the archive."""

    UNVERIFIED = "unverified"
    VERIFIED = "verified"


class _Frozen(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class ManifestFile(_Frozen):
    name: FileName
    url: HttpUrl
    role: FileRole
    sha256: Sha256Hex | None = None
    size_bytes: Annotated[int, Field(gt=0)] | None = None
    description: str | None = None


class SpatialMetadata(_Frozen):
    body: Literal["Moon"]
    frame: str | None = None
    projection: str | None = None
    nominal_resolution_m: Annotated[float, Field(gt=0)] | None = None
    coverage: str | None = None
    vertical_reference: str | None = None


class UrlVerification(_Frozen):
    status: UrlVerificationStatus
    checked_on: date | None = None
    note: str = Field(min_length=1)

    @model_validator(mode="after")
    def _verified_needs_date(self) -> UrlVerification:
        if self.status is UrlVerificationStatus.VERIFIED and self.checked_on is None:
            raise ValueError("verified URLs must record the date they were checked")
        return self


class DatasetManifest(_Frozen):
    schema_version: Literal[1]
    id: DatasetId
    title: str = Field(min_length=1)
    summary: str = Field(min_length=1)
    category: DatasetCategory
    evidence_kind: EvidenceKind
    provider: str = Field(min_length=1)
    mission: str | None = None
    instrument: str | None = None
    product_family: str | None = None
    source_page: HttpUrl
    storage_area: StorageArea
    files: tuple[ManifestFile, ...] = Field(min_length=1)
    spatial: SpatialMetadata | None = None
    units: str | None = None
    citation: str = Field(min_length=1)
    usage: str = Field(min_length=1)
    verification: UrlVerification
    required_by: tuple[str, ...] = ()
    notes: tuple[str, ...] = ()

    @model_validator(mode="after")
    def _check_files(self) -> DatasetManifest:
        names = [f.name for f in self.files]
        if len(names) != len(set(names)):
            raise ValueError(f"manifest {self.id!r} lists duplicate file names")
        if self.evidence_kind in {EvidenceKind.PLACEHOLDER, EvidenceKind.ASSUMPTION}:
            raise ValueError("external datasets cannot be placeholders or assumptions")
        if self.verification.status is UrlVerificationStatus.VERIFIED and any(
            f.sha256 is None or f.size_bytes is None for f in self.files
        ):
            raise ValueError(
                f"manifest {self.id!r} is marked verified, so every file must pin "
                "sha256 and size_bytes"
            )
        return self

    def fingerprint(self) -> str:
        """SHA-256 of the canonical JSON form; recorded at acquisition time so that later
        manifest edits (e.g. a corrected URL) are detectable."""
        canonical = self.model_dump_json(exclude_none=False).encode("utf-8")
        return hashlib.sha256(canonical).hexdigest()

    def file(self, name: str) -> ManifestFile:
        for entry in self.files:
            if entry.name == name:
                return entry
        raise KeyError(f"manifest {self.id!r} has no file named {name!r}")


__all__ = [
    "DatasetCategory",
    "DatasetId",
    "DatasetManifest",
    "FileRole",
    "ManifestFile",
    "Sha256Hex",
    "SpatialMetadata",
    "StorageArea",
    "UrlVerification",
    "UrlVerificationStatus",
]
