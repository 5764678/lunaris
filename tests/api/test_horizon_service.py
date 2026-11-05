"""Horizon mask service + GET /api/v1/sites/{id}/horizon (task T-16).

Uses the SYNTHETIC planar LDEM installed under the real dataset id (see
``tests/api/test_terrain_scenes.py``)."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from lunaris_api.app import create_app
from lunaris_api.services import horizon as horizon_service
from lunaris_api.settings import Settings
from tests.api.test_terrain_scenes import CACHE, _install_synthetic


@pytest.fixture
def horizon_client(settings: Settings) -> Iterator[TestClient]:
    CACHE.clear()
    with TestClient(create_app(settings)) as client:
        _install_synthetic(client, settings.data_dir)
        yield client
    CACHE.clear()


def _site(client: TestClient, lat: float, lon: float, name: str = "Ridge") -> str:
    response = client.post(
        "/api/v1/sites", json={"name": name, "latitude_deg": lat, "longitude_deg": lon}
    )
    assert response.status_code == 201
    return str(response.json()["id"])


def test_horizon_mask_fields_evidence_and_default_assumption(horizon_client: TestClient) -> None:
    site_id = _site(horizon_client, -89.5, 45.0)
    response = horizon_client.get(f"/api/v1/sites/{site_id}/horizon")
    assert response.status_code == 200
    body = response.json()
    assert len(body["azimuth_deg"]) == len(body["elevation_deg"]) == len(body["truncated"]) == 1440
    assert body["azimuth_step_deg"] == 0.25
    assert body["azimuth_deg"][:2] == [0.0, 0.25]
    assert body["max_range_m"] == 200_000.0
    assert body["observer_height_m"] == 2.0
    assert body["truncated_count"] == 0  # 200 km stays inside the ±256 km synthetic DEM
    assert body["dem"]["dataset_id"] == "lola-ldem-75s-240m"
    assert body["dem"]["sha256"] == body["evidence"]["sources"][0]["sha256"]
    assert body["evidence"]["kind"] == "calculation"
    assert "great circles" in body["method"]
    assert any("(default)" in a for a in body["evidence"]["assumptions"])
    assert not any("lower bound" in item for item in body["limitations"])


def test_cache_hit_does_not_recompute(
    horizon_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    site_id = _site(horizon_client, -89.5, 45.0)
    first = horizon_client.get(f"/api/v1/sites/{site_id}/horizon").json()
    cache_files = list(
        (horizon_client.app.state.data_layout.processed / "lola-ldem-75s-240m").rglob("*.npz")  # type: ignore[attr-defined]
    )
    assert len(cache_files) == 1

    def boom(*_: Any, **__: Any) -> Any:
        raise AssertionError("cache hit must not recompute")

    monkeypatch.setattr(horizon_service, "compute_horizon_mask", boom)
    second = horizon_client.get(f"/api/v1/sites/{site_id}/horizon").json()
    assert second["elevation_deg"] == first["elevation_deg"]
    assert second["truncated"] == first["truncated"]
    # A different observer height is a different key, hence a new computation.
    # (the middleware turns the patched-in AssertionError into a 500, proving a recompute)
    other = horizon_client.get(f"/api/v1/sites/{site_id}/horizon?observer_height_m=10")
    assert other.status_code == 500


def test_truncation_is_stated_in_limitations(horizon_client: TestClient) -> None:
    site_id = _site(horizon_client, -85.5, 0.0)  # ρ ≈ 137 km; +y edge at 256 km
    body = horizon_client.get(f"/api/v1/sites/{site_id}/horizon").json()
    assert body["truncated_count"] > 0
    assert body["limitations"][0].startswith(f"{body['truncated_count']} of 1440 azimuths")


def test_errors(horizon_client: TestClient, settings: Settings, tmp_path: Path) -> None:
    assert horizon_client.get("/api/v1/sites/nope/horizon").status_code == 404
    far = _site(horizon_client, -60.0, 0.0, name="Far")
    response = horizon_client.get(f"/api/v1/sites/{far}/horizon")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "out_of_coverage"
    near = _site(horizon_client, -89.5, 45.0, name="Near")
    assert (
        horizon_client.get(f"/api/v1/sites/{near}/horizon?observer_height_m=-1").status_code == 422
    )
    # Without the DEM acquired (separate, empty data store): 503.
    empty = settings.model_copy(update={"data_dir": tmp_path / "empty"})
    with TestClient(create_app(empty)) as client:
        plain = _site(client, -89.5, 45.0, name="Plain")
        response = client.get(f"/api/v1/sites/{plain}/horizon")
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "dataset_unavailable"
