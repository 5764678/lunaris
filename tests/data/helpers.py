"""Shared helpers for data-layer tests. All payloads are SYNTHETIC test bytes."""

from __future__ import annotations

import hashlib
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from lunaris_data.manifest import DatasetManifest


@dataclass
class FileServer:
    root: Path
    base_url: str

    def publish(self, name: str, payload: bytes) -> str:
        (self.root / name).write_bytes(payload)
        return f"{self.base_url}/{name}"


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


ManifestFactory = Callable[..., DatasetManifest]
