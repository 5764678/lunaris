"""Dataset registry endpoint: manifest metadata joined with local acquisition state."""

from __future__ import annotations

from fastapi.testclient import TestClient

from lunaris_api.settings import Settings
from lunaris_data.registry import DatasetRegistry
from lunaris_data.store import (
    AcquiredFile,
    AcquisitionRecord,
    DataLayout,
    ToolInfo,
    utc_now,
    write_record,
)


def test_lists_builtin_datasets_as_missing(client: TestClient) -> None:
    body = client.get("/api/v1/datasets").json()
    assert body["count"] == len(DatasetRegistry.load_builtin())
    by_id = {d["id"]: d for d in body["datasets"]}
    lola = by_id["lola-ldem-75s-240m"]
    assert lola["local"]["status"] == "missing"
    assert lola["local"]["files_expected"] == 2
    assert lola["url_verification"]["status"] == "verified"
    assert lola["url_verification"]["checked_on"] == "2026-11-04"
    assert lola["acquire_command"] == "uv run lunaris-data acquire lola-ldem-75s-240m"
    assert lola["spatial"]["frame"] == "MOON_ME"
    assert by_id["nasa-svs-cgi-moon-kit"]["category"] == "visualization"


def test_reports_acquired_dataset(client: TestClient, settings: Settings) -> None:
    """Simulate a completed acquisition (synthetic bytes + record) and check the status."""
    registry = DatasetRegistry.load_builtin()
    manifest = registry.get("naif-generic-kernels-lunar")
    layout = DataLayout.from_root(settings.data_dir)
    directory = layout.dataset_dir(manifest)
    directory.mkdir(parents=True)
    files = []
    for spec in manifest.files:
        payload = b"synthetic placeholder bytes for status test"
        (directory / spec.name).write_bytes(payload)
        files.append(
            AcquiredFile(
                name=spec.name,
                source_url=str(spec.url),
                final_url=str(spec.url),
                size_bytes=len(payload),
                sha256="0" * 64,
                retrieved_at_utc=utc_now(),
            )
        )
    write_record(
        directory,
        AcquisitionRecord(
            dataset_id=manifest.id,
            manifest_fingerprint=manifest.fingerprint(),
            acquired_at_utc=utc_now(),
            tool=ToolInfo(version="test"),
            files=tuple(files),
        ),
    )
    detail = client.get(f"/api/v1/datasets/{manifest.id}").json()
    assert detail["local"]["status"] == "acquired"
    assert detail["local"]["files_present"] == len(manifest.files)
    assert detail["local"]["acquired_at_utc"] is not None
    assert all(f["present"] for f in detail["files"])


def test_unknown_dataset_404(client: TestClient) -> None:
    response = client.get("/api/v1/datasets/not-registered")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_invalid_dataset_id_422(client: TestClient) -> None:
    assert client.get("/api/v1/datasets/BAD_ID").status_code == 422
