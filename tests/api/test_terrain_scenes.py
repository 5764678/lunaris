"""Terrain scene export endpoints (task T-12, contract C3)."""

from __future__ import annotations

import datetime as dt
from collections.abc import Iterator
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient

from lunaris_api.app import create_app
from lunaris_api.services.terrain import CACHE
from lunaris_api.settings import Settings
from lunaris_data.manifest import ManifestFile
from lunaris_data.registry import DatasetRegistry
from lunaris_data.store import AcquiredFile, AcquisitionRecord, ToolInfo, write_record
from lunaris_science.coordinates import spherical_to_cartesian
from tests.fixtures.terrain.synthetic_ldem import planar_height_at_map, write_planar_ldem

DATASET = "lola-ldem-75s-240m"
N, SCALE = 64, 8000.0
R = 1_737_400.0
BASE = "/api/v1/terrain/scenes"


@pytest.fixture(autouse=True)
def _clear_cache() -> Iterator[None]:
    CACHE.clear()
    yield
    CACHE.clear()


def _install_synthetic(client: TestClient, data_dir: Path, *, pin_matches: bool = True) -> None:
    """Install a SYNTHETIC product under the real dataset id, with a matching manifest."""
    builtin = DatasetRegistry.load_builtin().get(DATASET)
    directory = data_dir / "raw" / DATASET
    written = write_planar_ldem(directory, n=N, scale_m=SCALE)
    files = []
    for spec in builtin.files:
        size, digest = written[spec.name]
        pinned = digest if pin_matches or spec.role.value == "label" else "0" * 64
        files.append(
            ManifestFile.model_validate({**spec.model_dump(), "sha256": pinned, "size_bytes": size})
        )
    manifest = builtin.model_copy(update={"files": tuple(files)})
    now = dt.datetime.now(dt.UTC)
    record = AcquisitionRecord(
        dataset_id=DATASET,
        manifest_fingerprint=manifest.fingerprint(),
        acquired_at_utc=now,
        tool=ToolInfo(version="test"),
        files=tuple(
            AcquiredFile(
                name=name,
                source_url="https://example.invalid/" + name,
                final_url="https://example.invalid/" + name,
                size_bytes=size,
                sha256=digest,
                retrieved_at_utc=now,
            )
            for name, (size, digest) in written.items()
        ),
    )
    write_record(directory, record)
    client.app.state.dataset_registry = DatasetRegistry([manifest])  # type: ignore[attr-defined]


@pytest.fixture
def scene_client(settings: Settings) -> Iterator[TestClient]:
    with TestClient(create_app(settings)) as client:
        _install_synthetic(client, settings.data_dir)
        yield client


def test_list_reports_unavailable_without_dem(client: TestClient) -> None:
    body = client.get(BASE).json()
    assert body["count"] == 1
    scene = body["scenes"][0]
    assert scene["scene_id"] == "south-pole"
    assert scene["available"] is False
    assert scene["acquire_command"] == f"uv run lunaris-data acquire {DATASET}"
    response = client.get(f"{BASE}/south-pole")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "dataset_unavailable"


def test_unknown_scene_and_grid_cap(scene_client: TestClient) -> None:
    assert scene_client.get(f"{BASE}/north-pole").status_code == 404
    assert scene_client.get(f"{BASE}/south-pole?grid_size=1025").status_code == 422
    assert scene_client.get(f"{BASE}/south-pole/data?grid_size=1").status_code == 422


def test_metadata_contract_fields(scene_client: TestClient) -> None:
    assert scene_client.get(BASE).json()["scenes"][0]["available"] is True
    response = scene_client.get(f"{BASE}/south-pole?grid_size=101")
    assert response.status_code == 200
    meta = response.json()
    assert (meta["width"], meta["height"]) == (101, 101)
    assert meta["frame"] == "MOON_ME"
    assert meta["origin_moon_me_m"] == pytest.approx([0.0, 0.0, -R], abs=1e-6)
    assert meta["height_reference_radius_m"] == R
    assert meta["vertex_spacing_m"] == 2500.0
    assert meta["resampling"] == "bilinear"
    assert "NaN" in meta["nodata"]
    assert meta["dem"]["sha256"] == meta["evidence"]["sources"][0]["sha256"]
    assert meta["evidence"]["kind"] == "derived_product"
    assert meta["layout"]["byte_length"] == 101 * 101 * 16
    assert meta["data_url"] == f"{BASE}/south-pole/data?grid_size=101"
    assert response.headers["etag"] == meta["etag"]
    assert "max-age" in response.headers["cache-control"]


def test_binary_layout_and_vertex_spot_checks(scene_client: TestClient) -> None:
    grid, half = 101, 125_000.0
    meta = scene_client.get(f"{BASE}/south-pole?grid_size={grid}").json()
    response = scene_client.get(meta["data_url"])
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/octet-stream"
    assert len(response.content) == meta["layout"]["byte_length"]
    vertices = np.frombuffer(response.content, dtype="<f4").reshape(grid, grid, 4)
    origin = np.array(meta["origin_moon_me_m"])
    spacing = 2 * half / (grid - 1)
    for row, col in ((0, 0), (0, 100), (50, 50), (100, 100), (13, 77)):
        x, y = -half + col * spacing, half - row * spacing
        lat = np.degrees(2 * np.arctan(np.hypot(x, y) / (2 * R))) - 90.0
        lon = np.degrees(np.arctan2(x, y)) % 360.0
        h = planar_height_at_map(x, y, n=N, scale_m=SCALE)
        expected = spherical_to_cartesian(lat, lon, R + h)
        np.testing.assert_allclose(vertices[row, col, :3] + origin, expected, atol=0.05)
        assert float(vertices[row, col, 3]) == pytest.approx(h, abs=1e-3)
    assert float(np.nanmin(vertices[..., 3])) == pytest.approx(meta["height_min_m"])
    assert float(np.nanmax(vertices[..., 3])) == pytest.approx(meta["height_max_m"])


def test_etag_conditional_requests(scene_client: TestClient) -> None:
    first = scene_client.get(f"{BASE}/south-pole/data?grid_size=64")
    etag = first.headers["etag"]
    again = scene_client.get(
        f"{BASE}/south-pole/data?grid_size=64", headers={"If-None-Match": etag}
    )
    assert again.status_code == 304
    assert again.content == b""
    meta = scene_client.get(f"{BASE}/south-pole?grid_size=64", headers={"If-None-Match": etag})
    assert meta.status_code == 304
    other = scene_client.get(
        f"{BASE}/south-pole/data?grid_size=65", headers={"If-None-Match": etag}
    )
    assert other.status_code == 200
    assert other.headers["etag"] != etag


def test_size_cap_default_and_maximum(scene_client: TestClient) -> None:
    meta = scene_client.get(f"{BASE}/south-pole").json()
    assert (meta["width"], meta["height"]) == (512, 512)
    largest = scene_client.get(f"{BASE}/south-pole/data?grid_size=1024")
    assert len(largest.content) == 1024 * 1024 * 16  # 16 MiB cap


def test_refuses_dem_that_does_not_match_manifest_pin(settings: Settings) -> None:
    with TestClient(create_app(settings)) as client:
        _install_synthetic(client, settings.data_dir, pin_matches=False)
        response = client.get(f"{BASE}/south-pole")
        assert response.status_code == 503
        assert "SHA-256" in response.json()["error"]["message"]


REAL_DATA = Path("data").resolve()


@pytest.mark.skipif(
    not (REAL_DATA / "raw" / DATASET / "acquisition.json").is_file(),
    reason="LDEM_75S_240M not acquired",
)
def test_real_south_pole_scene() -> None:
    settings = Settings(environment="test", data_dir=REAL_DATA, log_level="WARNING")
    with TestClient(create_app(settings)) as client:
        meta = client.get(f"{BASE}/south-pole?grid_size=256").json()
        assert meta["dem"]["sha256"] == (
            "d031efe2611b17dfbf3c158f5e15dc04cd5719349dcbf6384bb21fd97697c490"
        )
        assert meta["nodata_vertex_count"] == 0  # ±125 km lies well inside 75°S coverage
        assert -15529 * 0.5 <= meta["height_min_m"] < meta["height_max_m"] <= 14049 * 0.5
        data = client.get(meta["data_url"]).content
        vertices = np.frombuffer(data, dtype="<f4").reshape(256, 256, 4)
        assert np.isfinite(vertices).all()
