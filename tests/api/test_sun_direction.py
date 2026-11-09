"""T-26: GET /api/v1/ephemeris/sun."""

from __future__ import annotations

import numpy as np
import pytest
from fastapi.testclient import TestClient

from tests.api.test_ephemeris import kernel_client  # noqa: F401 - fixture

URL = "/api/v1/ephemeris/sun"


def test_single_epoch(kernel_client: TestClient) -> None:  # noqa: F811
    params = {"start_utc": "2026-11-04T00:00:00Z", "end_utc": "2026-11-04T00:00:00Z", "step_s": 60}
    response = kernel_client.get(URL, params=params)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["sample_count"] == 1
    assert body["frame"] == "MOON_ME"
    assert body["origin"] == "MOON"
    assert body["aberration_correction"] == "CN+S"
    sample = body["samples"][0]
    assert np.linalg.norm(sample["direction_moon_me"]) == pytest.approx(1.0)
    # Horizons sub-solar point 248.597665 / −1.487871 (fixture), minus the 0.64″ light-time
    # offset explained in tests/science/geometry/test_moon_centred.py.
    assert sample["subsolar_longitude_deg"] == pytest.approx(248.597665, abs=1e-3)
    assert sample["subsolar_latitude_deg"] == pytest.approx(-1.487871, abs=1e-4)
    assert sample["angular_radius_deg"] == pytest.approx(0.269, abs=0.002)
    evidence = body["evidence"]
    assert evidence["kind"] == "model"
    assert "CN+S" in evidence["method"]
    assert all(len(s["sha256"]) == 64 for s in evidence["sources"])
    assert any("smooth sphere" in x for x in body["limitations"])


def test_window_and_cap(kernel_client: TestClient) -> None:  # noqa: F811
    day = {"start_utc": "2026-11-04T00:00:00Z", "end_utc": "2026-11-05T00:00:00Z", "step_s": 3600}
    assert kernel_client.get(URL, params=day).json()["sample_count"] == 25
    over = {**day, "end_utc": "2027-11-05T00:00:00Z", "step_s": 3000}  # 10 542 samples
    detail = kernel_client.get(URL, params=over).json()["error"]["details"][0]
    assert detail["type"] == "sample_cap_exceeded"
    assert detail["location"] == ["query", "step_s"]
    late = {"start_utc": "2160-01-01T00:00:00Z", "end_utc": "2160-01-01T00:00:00Z", "step_s": 60}
    assert kernel_client.get(URL, params=late).json()["error"]["details"][0]["type"] == (
        "outside_kernel_coverage"
    )
    backwards = {**day, "end_utc": "2026-11-03T00:00:00Z"}
    assert kernel_client.get(URL, params=backwards).status_code == 422


def test_missing_kernels_give_503(client: TestClient) -> None:
    params = {"start_utc": "2026-11-04T00:00:00Z", "end_utc": "2026-11-04T00:00:00Z", "step_s": 60}
    response = client.get(URL, params=params)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "kernels_unavailable"
