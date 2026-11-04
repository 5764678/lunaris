"""T-22: GET /api/v1/sites/{site_id}/ephemeris (contract C2)."""

from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient

from lunaris_api.app import create_app
from lunaris_api.schemas.ephemeris import MAX_EPHEMERIS_SAMPLES
from lunaris_api.services.ephemeris import KERNEL_DATASET_ID
from lunaris_api.settings import Settings
from lunaris_data.registry import DatasetRegistry
from lunaris_data.store import DataLayout, DatasetStatus, inspect_dataset

REPO_DATA = Path(os.environ.get("LUNARIS_DATA_DIR", Path(__file__).resolve().parents[2] / "data"))
WINDOW = {"start_utc": "2026-11-04T00:00:00Z", "end_utc": "2026-11-05T00:00:00Z", "step_s": 3600}


def _kernels_dir() -> Path:
    manifest = DatasetRegistry.load_builtin().get(KERNEL_DATASET_ID)
    state = inspect_dataset(manifest, DataLayout.from_root(REPO_DATA))
    if state.status is not DatasetStatus.ACQUIRED:
        message = f"kernels not acquired: run `uv run lunaris-data acquire {KERNEL_DATASET_ID}`"
        if os.environ.get("LUNARIS_REQUIRE_KERNELS") == "1":
            pytest.fail(message)
        pytest.skip(message)
    return state.directory


@pytest.fixture
def kernel_client(settings: Settings) -> Iterator[TestClient]:
    """API client whose (temporary) data root links to the verified kernel set."""
    source = _kernels_dir()
    target = settings.data_dir / "kernels" / KERNEL_DATASET_ID
    target.parent.mkdir(parents=True)
    target.symlink_to(source, target_is_directory=True)
    with TestClient(create_app(settings)) as test_client:
        yield test_client


def _create_site(client: TestClient, lat: float = -89.5, lon: float = 0.0) -> str:
    response = client.post(
        "/api/v1/sites",
        json={"name": f"Ephemeris test {lat} {lon}", "latitude_deg": lat, "longitude_deg": lon},
    )
    assert response.status_code == 201, response.text
    site_id: str = response.json()["id"]
    return site_id


def test_ephemeris_returns_sun_and_earth_series_with_evidence(kernel_client: TestClient) -> None:
    site_id = _create_site(kernel_client)
    response = kernel_client.get(f"/api/v1/sites/{site_id}/ephemeris", params=WINDOW)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["sample_count"] == 25
    assert body["max_samples"] == MAX_EPHEMERIS_SAMPLES
    assert body["frame"] == "MOON_ME"
    assert body["aberration_correction"] == "CN+S"
    assert body["observer"]["surface_height_m"] is None
    assert body["observer"]["radius_m"] == 1_737_400.0
    assert any("radio link" in item for item in body["limitations"])
    assert any("astronomical horizon" in item for item in body["limitations"])
    assert [b["body"] for b in body["bodies"]] == ["sun", "earth"]
    for series in body["bodies"]:
        samples = series["samples"]
        assert len(samples) == 25
        assert samples[0]["epoch_utc"] == "2026-11-04T00:00:00Z"
        assert samples[-1]["epoch_utc"] == "2026-11-05T00:00:00Z"
        assert np.linalg.norm(samples[0]["direction_moon_me"]) == pytest.approx(1.0)
        evidence = series["evidence"]
        assert evidence["kind"] == "model"
        assert "CN+S" in evidence["method"]
        names = {s["source_id"].split("/")[1] for s in evidence["sources"]}
        assert names == {
            "naif0012.tls",
            "pck00011.tpc",
            "de440s.bsp",
            "moon_pa_de440_200625.bpc",
            "moon_de440_250416.tf",
        }
        assert all(len(s["sha256"]) == 64 for s in evidence["sources"])
        assert any("h = 0 m" in a for a in evidence["assumptions"])
    sun, earth = body["bodies"]
    # Same values as the Horizons fixture (tested to 0.01 arcsec in tests/science/geometry).
    assert sun["samples"][0]["azimuth_deg"] == pytest.approx(248.586138344, abs=1e-6)
    assert sun["samples"][0]["elevation_deg"] == pytest.approx(1.304693770, abs=1e-6)
    assert earth["samples"][-1]["elevation_deg"] == pytest.approx(-2.606567816, abs=1e-6)


def test_sample_cap_is_enforced_with_a_clear_422(kernel_client: TestClient) -> None:
    site_id = _create_site(kernel_client)
    params = {
        "start_utc": "2026-01-01T00:00:00Z",
        "end_utc": "2027-01-01T00:00:00Z",
        "step_s": 3000,
    }
    response = kernel_client.get(f"/api/v1/sites/{site_id}/ephemeris", params=params)
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["details"][0]["type"] == "sample_cap_exceeded"
    assert error["details"][0]["location"] == ["query", "step_s"]
    assert "10513 samples" in error["message"]
    assert str(MAX_EPHEMERIS_SAMPLES) in error["message"]


def test_one_year_hourly_fits_the_cap(kernel_client: TestClient) -> None:
    site_id = _create_site(kernel_client)
    params = {
        "start_utc": "2026-01-01T00:00:00Z",
        "end_utc": "2026-12-31T23:00:00Z",
        "step_s": 3600,
    }
    response = kernel_client.get(f"/api/v1/sites/{site_id}/ephemeris", params=params)
    assert response.status_code == 200
    assert response.json()["sample_count"] == 8760


@pytest.mark.parametrize(
    ("params", "error_type"),
    [
        ({**WINDOW, "end_utc": "2026-11-03T00:00:00Z"}, "window_order"),
        ({**WINDOW, "start_utc": "2026-11-04T00:00:00+02:00"}, "utc_required"),
        (
            {
                "start_utc": "2160-01-01T00:00:00Z",
                "end_utc": "2160-01-02T00:00:00Z",
                "step_s": 3600,
            },
            "outside_kernel_coverage",
        ),
    ],
)
def test_unservable_windows_give_422(
    kernel_client: TestClient, params: dict[str, object], error_type: str
) -> None:
    site_id = _create_site(kernel_client)
    response = kernel_client.get(f"/api/v1/sites/{site_id}/ephemeris", params=params)
    assert response.status_code == 422, response.text
    assert response.json()["error"]["details"][0]["type"] == error_type


@pytest.mark.parametrize(
    "params",
    [
        {**WINDOW, "step_s": 0},
        {**WINDOW, "start_utc": "2026-11-04T00:00:00"},  # naive: no timezone
        {"start_utc": WINDOW["start_utc"], "step_s": 60},
    ],
)
def test_malformed_queries_give_422(client: TestClient, params: dict[str, object]) -> None:
    response = client.get("/api/v1/sites/abc/ephemeris", params=params)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_site_at_the_pole_is_rejected(kernel_client: TestClient) -> None:
    site_id = _create_site(kernel_client, lat=-90.0)
    response = kernel_client.get(f"/api/v1/sites/{site_id}/ephemeris", params=WINDOW)
    assert response.status_code == 422
    detail = response.json()["error"]["details"][0]
    assert detail["type"] == "topocentric_frame_undefined"
    assert detail["location"] == ["path", "site_id"]


def test_unknown_site_gives_404(client: TestClient) -> None:
    response = client.get("/api/v1/sites/does-not-exist/ephemeris", params=WINDOW)
    assert response.status_code == 404


def test_missing_kernels_give_503_with_the_acquire_command(client: TestClient) -> None:
    site_id = _create_site(client)
    response = client.get(f"/api/v1/sites/{site_id}/ephemeris", params=WINDOW)
    assert response.status_code == 503
    error = response.json()["error"]
    assert error["code"] == "kernels_unavailable"
    assert f"lunaris-data acquire {KERNEL_DATASET_ID}" in error["message"]
