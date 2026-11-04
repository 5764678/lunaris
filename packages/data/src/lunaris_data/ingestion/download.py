"""Streaming HTTP download with SHA-256 hashing and atomic placement."""

from __future__ import annotations

import hashlib
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import httpx

from lunaris_data.store import HttpValidators

CHUNK_SIZE = 1 << 20  # 1 MiB
ProgressCallback = Callable[[int, int | None], None]
"""Called with (bytes_received, total_bytes_or_None)."""


class DownloadError(RuntimeError):
    """The remote resource could not be retrieved."""


class IntegrityError(RuntimeError):
    """The retrieved content does not match the expected size or checksum."""


@dataclass(frozen=True, slots=True)
class DownloadResult:
    path: Path
    final_url: str
    size_bytes: int
    sha256: str
    http: HttpValidators


def sha256_file(path: Path, chunk_size: int = CHUNK_SIZE) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def download_file(
    client: httpx.Client,
    url: str,
    destination: Path,
    *,
    expected_sha256: str | None = None,
    expected_size: int | None = None,
    progress: ProgressCallback | None = None,
) -> DownloadResult:
    """Download ``url`` to ``destination``.

    Content is streamed to ``<destination>.part`` while being hashed, verified, and only
    then renamed into place, so an interrupted or corrupt transfer never leaves a file
    that looks complete.

    Raises:
        DownloadError: on transport errors or non-2xx responses.
        IntegrityError: if the size or SHA-256 differs from the expected values.
    """
    destination.parent.mkdir(parents=True, exist_ok=True)
    partial = destination.with_name(destination.name + ".part")
    digest = hashlib.sha256()
    received = 0
    try:
        with client.stream("GET", url, follow_redirects=True) as response:
            if response.status_code >= 400:  # noqa: PLR2004 - HTTP error class boundary
                raise DownloadError(
                    f"GET {url} returned HTTP {response.status_code} {response.reason_phrase}"
                )
            total_header = response.headers.get("content-length")
            total = int(total_header) if total_header and total_header.isdigit() else None
            with partial.open("wb") as handle:
                for chunk in response.iter_bytes(CHUNK_SIZE):
                    handle.write(chunk)
                    digest.update(chunk)
                    received += len(chunk)
                    if progress is not None:
                        progress(received, total)
            final_url = str(response.url)
            validators = HttpValidators(
                etag=response.headers.get("etag"),
                last_modified=response.headers.get("last-modified"),
                content_type=response.headers.get("content-type"),
            )
    except httpx.HTTPError as exc:
        partial.unlink(missing_ok=True)
        raise DownloadError(f"GET {url} failed: {exc}") from exc
    except BaseException:
        partial.unlink(missing_ok=True)
        raise

    sha256 = digest.hexdigest()
    if expected_size is not None and received != expected_size:
        partial.unlink(missing_ok=True)
        raise IntegrityError(
            f"{destination.name}: expected {expected_size} bytes, received {received}"
        )
    if expected_sha256 is not None and sha256 != expected_sha256:
        partial.unlink(missing_ok=True)
        raise IntegrityError(
            f"{destination.name}: SHA-256 mismatch (expected {expected_sha256}, got {sha256})"
        )
    partial.replace(destination)
    return DownloadResult(
        path=destination,
        final_url=final_url,
        size_bytes=received,
        sha256=sha256,
        http=validators,
    )


__all__ = [
    "CHUNK_SIZE",
    "DownloadError",
    "DownloadResult",
    "IntegrityError",
    "ProgressCallback",
    "download_file",
    "sha256_file",
]
