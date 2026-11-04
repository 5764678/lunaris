"""Re-verify acquired datasets against their acquisition records (full SHA-256)."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from lunaris_data.ingestion.download import sha256_file
from lunaris_data.manifest import DatasetManifest
from lunaris_data.store import DataLayout, read_record


class FileCheckResult(StrEnum):
    OK = "ok"
    MISSING = "missing"
    SIZE_MISMATCH = "size_mismatch"
    CHECKSUM_MISMATCH = "checksum_mismatch"
    PINNED_CHECKSUM_MISMATCH = "pinned_checksum_mismatch"
    """Matches the acquisition record but not the checksum pinned in the manifest."""
    UNRECORDED = "unrecorded"


@dataclass(frozen=True, slots=True)
class FileCheck:
    name: str
    result: FileCheckResult
    detail: str | None = None


@dataclass(frozen=True, slots=True)
class VerificationReport:
    dataset_id: str
    has_record: bool
    checks: tuple[FileCheck, ...]

    @property
    def ok(self) -> bool:
        return self.has_record and all(c.result is FileCheckResult.OK for c in self.checks)


def verify_dataset(manifest: DatasetManifest, layout: DataLayout) -> VerificationReport:
    """Hash every file of the dataset and compare with the acquisition record and any
    checksum pinned in the manifest."""
    directory = layout.dataset_dir(manifest)
    record = read_record(directory) if directory.is_dir() else None
    checks: list[FileCheck] = []
    for spec in manifest.files:
        path = directory / spec.name
        recorded = record.file(spec.name) if record else None
        if not path.is_file():
            checks.append(FileCheck(spec.name, FileCheckResult.MISSING))
            continue
        if recorded is None:
            checks.append(
                FileCheck(spec.name, FileCheckResult.UNRECORDED, "no acquisition record entry")
            )
            continue
        size = path.stat().st_size
        if size != recorded.size_bytes:
            checks.append(
                FileCheck(
                    spec.name,
                    FileCheckResult.SIZE_MISMATCH,
                    f"recorded {recorded.size_bytes} bytes, found {size}",
                )
            )
            continue
        digest = sha256_file(path)
        if digest != recorded.sha256:
            checks.append(
                FileCheck(
                    spec.name,
                    FileCheckResult.CHECKSUM_MISMATCH,
                    f"recorded {recorded.sha256}, computed {digest}",
                )
            )
        elif spec.sha256 is not None and digest != spec.sha256:
            checks.append(
                FileCheck(
                    spec.name,
                    FileCheckResult.PINNED_CHECKSUM_MISMATCH,
                    f"manifest pins {spec.sha256}, computed {digest}",
                )
            )
        else:
            checks.append(FileCheck(spec.name, FileCheckResult.OK))
    return VerificationReport(
        dataset_id=manifest.id, has_record=record is not None, checks=tuple(checks)
    )


__all__ = ["FileCheck", "FileCheckResult", "VerificationReport", "verify_dataset"]
