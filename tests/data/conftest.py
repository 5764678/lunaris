"""Fixtures for the data layer: a loopback HTTP file server and synthetic manifests.

All payloads served here are SYNTHETIC test bytes, not lunar data.
"""

from __future__ import annotations

import functools
import threading
from collections.abc import Iterator
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

import httpx
import pytest

from lunaris_data.manifest import DatasetManifest
from lunaris_data.store import DataLayout
from tests.data.helpers import FileServer, ManifestFactory


class _QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:
        return


@pytest.fixture
def file_server(tmp_path: Path) -> Iterator[FileServer]:
    root = tmp_path / "remote"
    root.mkdir()
    handler = functools.partial(_QuietHandler, directory=str(root))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield FileServer(root=root, base_url=f"http://127.0.0.1:{server.server_address[1]}")
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


@pytest.fixture
def layout(tmp_path: Path) -> DataLayout:
    return DataLayout.from_root(tmp_path / "data")


@pytest.fixture
def http_client() -> Iterator[httpx.Client]:
    # trust_env=False: never route loopback test traffic through a configured proxy.
    with httpx.Client(trust_env=False, timeout=10.0) as client:
        yield client


@pytest.fixture
def make_manifest() -> ManifestFactory:
    def factory(
        files: list[dict[str, Any]],
        *,
        dataset_id: str = "synthetic-test-dataset",
        category: str = "terrain",
        note: str = "synthetic test manifest",
    ) -> DatasetManifest:
        return DatasetManifest.model_validate(
            {
                "schema_version": 1,
                "id": dataset_id,
                "title": "Synthetic test dataset (not lunar data)",
                "summary": "Synthetic bytes served from a loopback test server.",
                "category": category,
                "evidence_kind": "derived_product",
                "provider": "LUNARIS test suite",
                "source_page": "http://127.0.0.1/",
                "storage_area": "raw",
                "files": files,
                "citation": "n/a — synthetic",
                "usage": "tests only",
                "verification": {"status": "unverified", "note": note},
            }
        )

    return factory
