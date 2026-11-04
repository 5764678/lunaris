"""Local data store layout, acquisition records and dataset status.

Layout (relative to the data root, ``./data`` by default)::

    raw/<dataset-id>/        acquired source products + acquisition.json
    processed/<dataset-id>/  LUNARIS-derived artefacts (Milestone 02+)
    kernels/<dataset-id>/    SPICE kernels + acquisition.json
    fixtures/                small synthetic test fixtures (committed)
    state/                   application state (SQLite development database)

A dataset counts as *acquired* only when every manifest file is present with the
size recorded in its ``acquisition.json``. Files without a record are *untracked*:
their provenance is unknown, so LUNARIS does not use them.
"""

from __future__ import annotations

import json
import os
import tempfile
from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
from pathlib import Path
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from lunaris_data.manifest import DatasetManifest, Sha256Hex, StorageArea

ACQUISITION_RECORD_NAME = "acquisition.json"


class HttpValidators(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    etag: str | None = None
    last_modified: str | None = None
    content_type: str | None = None


class AcquiredFile(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    name: str
    source_url: str
    final_url: str
    size_bytes: Annotated[int, Field(ge=0)]
    sha256: Sha256Hex
    retrieved_at_utc: datetime
    http: HttpValidators = HttpValidators()


class ToolInfo(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    name: Literal["lunaris-data"] = "lunaris-data"
    version: str


class AcquisitionRecord(BaseModel):
    """Provenance record written next to every acquired dataset."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    schema_version: Literal[1] = 1
    dataset_id: str
    manifest_fingerprint: Sha256Hex
    acquired_at_utc: datetime
    tool: ToolInfo
    files: tuple[AcquiredFile, ...]

    def file(self, name: str) -> AcquiredFile | None:
        return next((f for f in self.files if f.name == name), None)


class DatasetStatus(StrEnum):
    MISSING = "missing"
    """Nothing present locally."""
    INCOMPLETE = "incomplete"
    """An acquisition record exists but files are missing or differ in size."""
    UNTRACKED = "untracked"
    """Files are present without an acquisition record: provenance unknown."""
    ACQUIRED = "acquired"
    """All files present and consistent with the acquisition record."""


@dataclass(frozen=True, slots=True)
class FileState:
    name: str
    present: bool
    size_bytes: int | None
    recorded_size_bytes: int | None
    recorded_sha256: str | None

    @property
    def consistent(self) -> bool:
        return (
            self.present
            and self.recorded_size_bytes is not None
            and self.size_bytes == self.recorded_size_bytes
        )


@dataclass(frozen=True, slots=True)
class DatasetLocalState:
    dataset_id: str
    status: DatasetStatus
    directory: Path
    files: tuple[FileState, ...]
    record: AcquisitionRecord | None
    manifest_changed: bool

    @property
    def files_present(self) -> int:
        return sum(1 for f in self.files if f.present)

    @property
    def bytes_on_disk(self) -> int:
        return sum(f.size_bytes or 0 for f in self.files)


@dataclass(frozen=True, slots=True)
class DataLayout:
    """Resolved locations of the local data store."""

    root: Path

    @classmethod
    def from_root(cls, root: str | Path) -> DataLayout:
        return cls(Path(root).expanduser().resolve())

    @property
    def raw(self) -> Path:
        return self.root / "raw"

    @property
    def processed(self) -> Path:
        return self.root / "processed"

    @property
    def kernels(self) -> Path:
        return self.root / "kernels"

    @property
    def fixtures(self) -> Path:
        return self.root / "fixtures"

    @property
    def state(self) -> Path:
        return self.root / "state"

    def area(self, area: StorageArea) -> Path:
        return {StorageArea.RAW: self.raw, StorageArea.KERNELS: self.kernels}[area]

    def dataset_dir(self, manifest: DatasetManifest) -> Path:
        return self.area(manifest.storage_area) / manifest.id


def utc_now() -> datetime:
    return datetime.now(UTC)


def read_record(directory: Path) -> AcquisitionRecord | None:
    path = directory / ACQUISITION_RECORD_NAME
    if not path.is_file():
        return None
    return AcquisitionRecord.model_validate_json(path.read_text(encoding="utf-8"))


def write_record(directory: Path, record: AcquisitionRecord) -> Path:
    """Atomically write ``acquisition.json`` (write to a temp file, then rename)."""
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / ACQUISITION_RECORD_NAME
    payload = json.dumps(record.model_dump(mode="json"), indent=2, sort_keys=False) + "\n"
    fd, tmp_name = tempfile.mkstemp(prefix=".acquisition-", suffix=".json", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(payload)
        Path(tmp_name).replace(target)
    except BaseException:
        Path(tmp_name).unlink(missing_ok=True)
        raise
    return target


def inspect_dataset(manifest: DatasetManifest, layout: DataLayout) -> DatasetLocalState:
    """Determine the local status of a dataset without hashing file contents.

    Hashing multi-gigabyte rasters on every status query would be too slow; full
    integrity verification is an explicit operation
    (:func:`lunaris_data.validation.integrity.verify_dataset`).
    """
    directory = layout.dataset_dir(manifest)
    record = read_record(directory) if directory.is_dir() else None

    states = []
    for spec in manifest.files:
        path = directory / spec.name
        present = path.is_file()
        recorded = record.file(spec.name) if record else None
        states.append(
            FileState(
                name=spec.name,
                present=present,
                size_bytes=path.stat().st_size if present else None,
                recorded_size_bytes=recorded.size_bytes if recorded else None,
                recorded_sha256=recorded.sha256 if recorded else None,
            )
        )
    files = tuple(states)

    if record is None:
        status = DatasetStatus.UNTRACKED if any(f.present for f in files) else DatasetStatus.MISSING
    elif all(f.consistent for f in files):
        status = DatasetStatus.ACQUIRED
    else:
        status = DatasetStatus.INCOMPLETE

    return DatasetLocalState(
        dataset_id=manifest.id,
        status=status,
        directory=directory,
        files=files,
        record=record,
        manifest_changed=record is not None
        and record.manifest_fingerprint != manifest.fingerprint(),
    )


__all__ = [
    "ACQUISITION_RECORD_NAME",
    "AcquiredFile",
    "AcquisitionRecord",
    "DataLayout",
    "DatasetLocalState",
    "DatasetStatus",
    "FileState",
    "HttpValidators",
    "ToolInfo",
    "inspect_dataset",
    "read_record",
    "utc_now",
    "write_record",
]
