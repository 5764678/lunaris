"""K-01: GET /api/v1/ephemeris/moon-phase (contract L1)."""

from __future__ import annotations

import numpy as np
import pytest
from fastapi.testclient import TestClient

from tests.api.test_ephemeris import kernel_client  # noqa: F401 - fixture

URL = "/api/v1/ephemeris/moon-phase"
FIELDS = {
    "epoch_utc",
    "earth_direction_moon_me",
    "subearth_latitude_deg",
    "subearth_longitude_deg",
    "phase_angle_deg",
    "illuminated_fraction",
    "elongation_deg",
    "waxing",
}


def test_single_epoch_near_full_moon(kernel_client: TestClient) -> None:  # noqa: F811
    # 2027-01-22 12:00 UTC. Horizons (fixture row 86): Illu% 99.97851, S-O-T 178.3165°,
    # S-T-O 1.6793°.
    params = {"start_utc": "2027-01-22T12:00:00Z", "end_utc": "2027-01-22T12:00:00Z", "step_s": 60}
    response = kernel_client.get(URL, params=params)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["sample_count"] == 1
    assert body["frame"] == "MOON_ME"
    assert body["origin"] == "MOON"
    assert body["viewpoint"] == "geocentric"
    assert body["aberration_correction"] == "CN+S"
    sample = body["samples"][0]
    assert set(sample) == FIELDS
    assert np.linalg.norm(sample["earth_direction_moon_me"]) == pytest.approx(1.0)
    assert 0.0 <= sample["subearth_longitude_deg"] < 360.0
    assert sample["phase_angle_deg"] == pytest.approx(1.6793, abs=1e-4)
    assert sample["elongation_deg"] == pytest.approx(178.3165, abs=1e-4)
    assert sample["illuminated_fraction"] == pytest.approx(0.9997851, abs=1e-4)
    assert sample["waxing"] is True  # 17 min before full Moon (D < 180°)
    evidence = body["evidence"]
    assert evidence["kind"] == "model"
    assert "phaseq" in evidence["method"]
    assert all(len(s["sha256"]) == 64 for s in evidence["sources"])
    assert any("Geocentric" in x for x in body["limitations"])
    assert any("earthshine" in x for x in body["limitations"])


def test_one_lunation_hourly(kernel_client: TestClient) -> None:  # noqa: F811
    params = {
        "start_utc": "2027-01-07T00:00:00Z",
        "end_utc": "2027-02-06T00:00:00Z",
        "step_s": 3600,
    }
    body = kernel_client.get(URL, params=params).json()
    assert body["sample_count"] == 30 * 24 + 1
    fraction = np.array([s["illuminated_fraction"] for s in body["samples"]])
    waxing = np.array([s["waxing"] for s in body["samples"]])
    assert fraction.min() < 0.001
    assert fraction.max() > 0.999
    # Waning before the 2027-01-07 20:24 new Moon, waxing to full Moon, waning after it.
    assert not waxing[0]
    assert waxing[24]
    assert not waxing[-1]
    assert np.count_nonzero(np.diff(waxing.astype(int))) == 2


def test_window_and_cap(kernel_client: TestClient) -> None:  # noqa: F811
    over = {"start_utc": "2027-01-01T00:00:00Z", "end_utc": "2028-02-01T00:00:00Z", "step_s": 3000}
    detail = kernel_client.get(URL, params=over).json()["error"]["details"][0]
    assert detail["type"] == "sample_cap_exceeded"
    late = {"start_utc": "2160-01-01T00:00:00Z", "end_utc": "2160-01-01T00:00:00Z", "step_s": 60}
    assert kernel_client.get(URL, params=late).json()["error"]["details"][0]["type"] == (
        "outside_kernel_coverage"
    )
    backwards = {
        "start_utc": "2027-01-02T00:00:00Z",
        "end_utc": "2027-01-01T00:00:00Z",
        "step_s": 60,
    }
    assert kernel_client.get(URL, params=backwards).status_code == 422


def test_missing_kernels_give_503(client: TestClient) -> None:
    params = {"start_utc": "2027-01-01T00:00:00Z", "end_utc": "2027-01-01T00:00:00Z", "step_s": 60}
    response = client.get(URL, params=params)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "kernels_unavailable"
