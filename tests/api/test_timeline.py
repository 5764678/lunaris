"""T-24: POST /api/v1/analysis/timeline (contract C4)."""

from __future__ import annotations

import numpy as np
import pytest
from fastapi.testclient import TestClient

from lunaris_api.services.illumination import dem_source
from lunaris_data.registry import DatasetRegistry
from lunaris_science.coordinates import SelenographicCoordinate
from lunaris_science.horizon_mask import HorizonMask
from lunaris_science.visibility import RADIO_LINK_DISCLAIMER
from tests.api.test_ephemeris import _create_site, kernel_client  # noqa: F401 - fixture

URL = "/api/v1/analysis/timeline"
DAY = {"start_utc": "2026-11-04T00:00:00Z", "end_utc": "2026-11-05T00:00:00Z", "step_s": 3600}


def test_fixture_day_timeline(kernel_client: TestClient) -> None:  # noqa: F811
    site_id = _create_site(kernel_client)
    response = kernel_client.post(URL, json={"site_id": site_id, **DAY})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["sample_count"] == 25
    assert body["terrain_horizon_available"] is False

    sun = body["illumination"]
    assert sun["body"] == "sun"
    assert sun["terrain"] is None
    astro = sun["astronomical"]
    assert astro["horizon"] == "astronomical"
    # Sun elevation 1.22°–1.30°, radius ≈ 0.27°: the whole disk is up all day.
    assert astro["mean_visible_disk_fraction"] == 1.0
    assert astro["illuminated_fraction"] == 1.0
    assert astro["fully_lit_fraction"] == 1.0
    assert astro["longest_illumination_s"] == pytest.approx(25 * 3600, abs=1e-3)
    assert astro["longest_illumination_censored"] is True
    assert astro["longest_darkness_s"] == 0.0
    assert len(astro["sunlit_windows"]) == 1
    window = astro["sunlit_windows"][0]
    assert window["start_utc"] == "2026-11-04T00:00:00Z"
    assert window["end_utc"] == "2026-11-05T01:00:00Z"
    sample = sun["samples"][0]
    assert sample["astronomical_visible_fraction"] == 1.0
    assert sample["terrain_visible_fraction"] is None
    assert any("Terrain horizon not available" in x for x in sun["limitations"])
    assert sun["evidence"]["kind"] == "calculation"
    assert any(s["source_id"].endswith("de440s.bsp") for s in sun["evidence"]["sources"])

    earth = body["earth_visibility"]
    assert earth["body"] == "earth"
    assert earth["limitations"][0] == RADIO_LINK_DISCLAIMER
    # Earth elevation −1.16° … −2.61°, radius ≈ 0.95°: the whole disk is down all day.
    assert earth["astronomical"]["visible_fraction"] == 0.0
    assert earth["astronomical"]["windows"] == []
    assert earth["astronomical"]["longest_outage_censored"] is True
    assert {s["line_of_sight"] for s in earth["samples"]} == {"below_geometric_horizon"}

    names = {c["name"] for c in body["software"]["components"]}
    assert {"cspice", "numpy", "lunaris-science"} <= names


def test_window_errors_point_at_the_request_body(kernel_client: TestClient) -> None:  # noqa: F811
    site_id = _create_site(kernel_client)
    payload = {"site_id": site_id, **DAY, "start_utc": "2026-01-01T00:00:00Z", "step_s": 60}
    response = kernel_client.post(URL, json=payload)
    assert response.status_code == 422
    detail = response.json()["error"]["details"][0]
    assert detail["type"] == "sample_cap_exceeded"
    assert detail["location"] == ["body", "step_s"]


def test_pole_site_and_unknown_site(kernel_client: TestClient) -> None:  # noqa: F811
    pole = _create_site(kernel_client, lat=-90.0)
    response = kernel_client.post(URL, json={"site_id": pole, **DAY})
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["location"] == ["body", "site_id"]
    assert kernel_client.post(URL, json={"site_id": "nope", **DAY}).status_code == 404


def test_unknown_fields_are_rejected(client: TestClient) -> None:
    response = client.post(URL, json={"site_id": "abc", **DAY, "horizon": "terrain"})
    assert response.status_code == 422


def test_dem_source_carries_dataset_id_url_and_checksum() -> None:
    """TD condition on C4: every evidence source names its dataset, URL and SHA-256."""
    registry = DatasetRegistry.load_builtin()
    manifest = registry.get("lola-ldem-75s-240m")
    img = next(f for f in manifest.files if f.name.endswith(".IMG"))
    assert img.sha256 is not None
    mask = HorizonMask(
        site=SelenographicCoordinate(-89.5, 0.0, 0.0),
        observer_height_m=2.0,
        surface_height_m=0.0,
        azimuth_deg=np.arange(360, dtype=np.float64),
        elevation_deg=np.zeros(360),
        truncated=np.zeros(360, dtype=bool),
        max_range_m=200_000.0,
        dem_source_id=manifest.id,
        dem_sha256=img.sha256,
        dem_resolution_m=240.0,
        method="synthetic flat horizon (test only)",
    )
    source = dem_source(mask, registry)
    assert source.source_id == f"{manifest.id}/{img.name}"
    assert source.url == str(img.url)
    assert source.sha256 == img.sha256
    mismatched = HorizonMask(
        **{**{f: getattr(mask, f) for f in mask.__slots__}, "dem_sha256": "f" * 64}
    )
    with pytest.raises(ValueError, match="matches no file"):
        dem_source(mismatched, registry)
