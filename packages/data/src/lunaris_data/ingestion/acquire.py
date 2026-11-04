"""Acquire a registered dataset into the local store and record its provenance."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

import httpx

from lunaris_data import __version__
from lunaris_data.ingestion.download import (
    DownloadError,
    IntegrityError,
    ProgressCallback,
    download_file,
)
from lunaris_data.manifest import DatasetManifest, UrlVerificationStatus
from lunaris_data.store import (
    AcquiredFile,
    AcquisitionRecord,
    DataLayout,
    DatasetStatus,
    ToolInfo,
    inspect_dataset,
    utc_now,
    write_record,
)

USER_AGENT = f"lunaris-data/{__version__} (reproducible dataset acquisition)"
DEFAULT_TIMEOUT = httpx.Timeout(connect=20.0, read=120.0, write=60.0, pool=20.0)


class AcquisitionError(RuntimeError):
    """Acquisition failed; no acquisition record was written."""


@dataclass(frozen=True, slots=True)
class AcquisitionOutcome:
    record: AcquisitionRecord
    skipped: bool
    """True when the dataset was already acquired and ``force`` was not set."""


FileProgressFactory = Callable[[str], ProgressCallback | None]


def acquire_dataset(
    manifest: DatasetManifest,
    layout: DataLayout,
    *,
    client: httpx.Client | None = None,
    force: bool = False,
    progress_for: FileProgressFactory | None = None,
) -> AcquisitionOutcome:
    """Download every file of ``manifest`` and write ``acquisition.json``.

    The record is written only after *all* files are downloaded and verified, so a
    failed run leaves the dataset ``incomplete``/``untracked`` rather than falsely
    ``acquired``.

    Raises:
        AcquisitionError: wrapping the underlying download or integrity error, or for a
            remote-window dataset, which is read in windows and never downloaded whole.
    """
    if manifest.is_remote_window:
        raise AcquisitionError(
            f"{manifest.id!r} is a remote windowed source: it is read as windows over HTTP "
            "(lunaris_data.remote.window) and never downloaded whole"
        )
    state = inspect_dataset(manifest, layout)
    if state.status is DatasetStatus.ACQUIRED and not force and state.record is not None:
        return AcquisitionOutcome(record=state.record, skipped=True)

    directory = layout.dataset_dir(manifest)
    directory.mkdir(parents=True, exist_ok=True)
    owns_client = client is None
    http = client or httpx.Client(timeout=DEFAULT_TIMEOUT, headers={"User-Agent": USER_AGENT})
    acquired: list[AcquiredFile] = []
    try:
        for spec in manifest.files:
            try:
                result = download_file(
                    http,
                    str(spec.url),
                    directory / spec.name,
                    expected_sha256=spec.sha256,
                    expected_size=spec.size_bytes,
                    progress=progress_for(spec.name) if progress_for else None,
                )
            except (DownloadError, IntegrityError) as exc:
                hint = ""
                if manifest.verification.status is UrlVerificationStatus.UNVERIFIED:
                    hint = (
                        f" (this manifest's URLs are unverified — check {manifest.source_page}"
                        " and update the manifest if the archive layout differs)"
                    )
                raise AcquisitionError(f"{manifest.id}: {exc}{hint}") from exc
            acquired.append(
                AcquiredFile(
                    name=spec.name,
                    source_url=str(spec.url),
                    final_url=result.final_url,
                    size_bytes=result.size_bytes,
                    sha256=result.sha256,
                    retrieved_at_utc=utc_now(),
                    http=result.http,
                )
            )
    finally:
        if owns_client:
            http.close()

    record = AcquisitionRecord(
        dataset_id=manifest.id,
        manifest_fingerprint=manifest.fingerprint(),
        acquired_at_utc=utc_now(),
        tool=ToolInfo(version=__version__),
        files=tuple(acquired),
    )
    write_record(directory, record)
    return AcquisitionOutcome(record=record, skipped=False)


__all__ = ["USER_AGENT", "AcquisitionError", "AcquisitionOutcome", "acquire_dataset"]
