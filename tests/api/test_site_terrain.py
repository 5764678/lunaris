"""GET /api/v1/sites/{id}/terrain (task T-14). The PGDA window read is replaced by a
SYNTHETIC DEM window so the test needs no network."""

from __future__ import annotations

import math
from typing import Any

import numpy as np
import pytest
from fastapi.testclient import TestClient

from lunaris_api.services import terrain as terrain_service
from lunaris_data.remote.window import DemWindow, RemoteWindowError, WindowProvenance
from lunaris_science.terrain.dem import PolarDem
from lunaris_science.terrain.polar_stereographic import (
    PolarStereographicGrid,
    SouthPolarStereographic,
)

R = 1_737_400.0
PROJ = SouthPolarStereographic(R)
SLOPE_DEG = 12.0


def _fake_window(
    source: Any, *, latitude_deg: float, longitude_deg: float, side_px: int, **_: Any
) -> DemWindow:
    x0, y0 = (float(v) for v in PROJ.forward(latitude_deg, longitude_deg))
    k = float(PROJ.scale_factor_at_map(x0, y0))
    n, scale = side_px, 20.0
    offset = (n - 1) / 2
    grid = PolarStereographicGrid(n, n, offset + y0 / scale, offset - x0 / scale, scale, PROJ)
    lines = np.arange(n, dtype=np.float64)[:, None]
    samples = np.arange(n, dtype=np.float64)[None, :]
    _, y = np.broadcast_arrays(*grid.pixel_to_map(lines, samples))
    heights = (math.tan(math.radians(SLOPE_DEG)) * (y - y0) / k + 1500.0).astype(np.float32)
    dem = PolarDem(heights, grid, R, source.dataset_id, "synthetic", "0" * 64, "MOON_ME")
    provenance = WindowProvenance(
        dataset_id=source.dataset_id,
        url=source.url,
        etag=source.etag,
        last_modified=source.last_modified,
        content_length=source.size_bytes,
        window_col_row_width_height=(1, 2, n, n),
        window_map_bounds_m=(0.0, 1.0, 0.0, 1.0),
        resolution_m=scale,
        geotransform_a_c_f=(scale, -304000.0, 304000.0),
        http_requests=3,
        http_retries=1,
        bytes_requested=123456,
        read_at_utc="2026-11-04T00:00:00+00:00",
        served_from_cache=False,
        tool="test",
    )
    return DemWindow(dem, provenance)


@pytest.fixture
def site_id(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> str:
    monkeypatch.setattr(terrain_service, "read_window", _fake_window)
    response = client.post(
        "/api/v1/sites",
        json={"name": "Connecting ridge", "latitude_deg": -89.45, "longitude_deg": 222.69},
    )
    assert response.status_code == 201
    return str(response.json()["id"])


def test_site_terrain_values_baselines_and_evidence(client: TestClient, site_id: str) -> None:
    response = client.get(f"/api/v1/sites/{site_id}/terrain?footprint_radius_m=100")
    assert response.status_code == 200
    body = response.json()
    assert body["height_m"] == pytest.approx(1500.0, abs=1e-3)
    assert body["slope_at_site"]["slope_deg"] == pytest.approx(SLOPE_DEG, abs=0.1)
    assert body["slope_at_site"]["baseline_m"] == pytest.approx(40.0 / body["scale_factor"])
    fp = body["footprint"]
    assert fp["slope_mean_deg"] == pytest.approx(SLOPE_DEG, abs=0.1)
    assert fp["slope_baseline_m"] > 0
    assert fp["roughness_baseline_m"] == 200.0
    assert fp["roughness_rms_m"] < 0.01
    assert fp["missing_cell_count"] == 0
    assert body["hazard"] is None  # no thresholds supplied → no hazard verdict
    assert body["evidence"]["kind"] == "calculation"
    assert body["evidence"]["sources"][0]["source_id"] == "pgda-lola-20mpp-80s"
    assert "Horn" in body["evidence"]["method"]
    assert body["dem"]["bytes_requested"] == 123456
    assert body["dem"]["http_retries"] == 1
    assert body["limitations"]


def test_hazard_thresholds_are_echoed_as_assumptions(client: TestClient, site_id: str) -> None:
    body = client.get(
        f"/api/v1/sites/{site_id}/terrain?footprint_radius_m=60&max_slope_deg=10&max_roughness_m=1"
    ).json()
    hazard = body["hazard"]
    assert hazard["max_slope_deg"] == 10.0
    assert hazard["slope_p95_exceeds"] is True
    assert hazard["slope_fraction_above"] == pytest.approx(1.0)
    assert hazard["roughness_exceeds"] is False
    assert hazard["evidence"]["kind"] == "assumption"
    assert "max_slope_deg = 10.0" in hazard["evidence"]["assumptions"]


def test_validation_and_errors(
    client: TestClient, site_id: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    assert client.get("/api/v1/sites/nope/terrain").status_code == 404
    assert client.get(f"/api/v1/sites/{site_id}/terrain?footprint_radius_m=0").status_code == 422
    assert client.get(f"/api/v1/sites/{site_id}/terrain?max_slope_deg=95").status_code == 422

    def outside(*_: Any, **__: Any) -> DemWindow:
        raise RemoteWindowError("the window lies outside the raster")

    monkeypatch.setattr(terrain_service, "read_window", outside)
    response = client.get(f"/api/v1/sites/{site_id}/terrain")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "out_of_coverage"

    def down(*_: Any, **__: Any) -> DemWindow:
        raise RemoteWindowError("HEAD failed")

    monkeypatch.setattr(terrain_service, "read_window", down)
    response = client.get(f"/api/v1/sites/{site_id}/terrain")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "dataset_unavailable"
