"""Site comparison table (task T-17). SYNTHETIC LDEM + synthetic PGDA window."""

from __future__ import annotations

import os
from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from lunaris_api.app import create_app
from lunaris_api.services import terrain as terrain_service
from lunaris_api.services.compare import ILLUMINATION_KEYS, ILLUMINATION_UNAVAILABLE
from lunaris_api.settings import Settings
from lunaris_data.registry import DatasetRegistry
from lunaris_data.remote.window import RemoteWindowError
from tests.api.test_site_terrain import SLOPE_DEG, _fake_window
from tests.api.test_terrain_scenes import CACHE, _install_synthetic

URL = "/api/v1/analysis/site-comparison"


@pytest.fixture
def compare_client(settings: Settings, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    def window_with_coverage(source: Any, *, latitude_deg: float, **kwargs: Any) -> Any:
        if latitude_deg > -80.0:  # like the real PGDA 20 m mosaic (about 80°S–90°S)
            raise RemoteWindowError("the window lies outside the raster")
        return _fake_window(source, latitude_deg=latitude_deg, **kwargs)

    monkeypatch.setattr(terrain_service, "read_window", window_with_coverage)
    CACHE.clear()
    with TestClient(create_app(settings)) as client:
        _install_synthetic(client, settings.data_dir)
        synthetic_ldem = client.app.state.dataset_registry.get("lola-ldem-75s-240m")  # type: ignore[attr-defined]
        builtin = DatasetRegistry.load_builtin()
        others = [builtin.get("pgda-lola-20mpp-80s"), builtin.get("naif-generic-kernels-lunar")]
        client.app.state.dataset_registry = DatasetRegistry([synthetic_ldem, *others])  # type: ignore[attr-defined]
        yield client
    CACHE.clear()


def _sites(client: TestClient) -> list[str]:
    ids = []
    for name, lat, lon in (("A", -89.5, 45.0), ("B", -89.2, 200.0), ("C", -88.8, 300.0)):
        r = client.post(
            "/api/v1/sites", json={"name": name, "latitude_deg": lat, "longitude_deg": lon}
        )
        ids.append(r.json()["id"])
    return ids


def test_compare_rows_cells_and_evidence(compare_client: TestClient) -> None:
    ids = _sites(compare_client)
    response = compare_client.get(URL, params={"site_ids": ",".join(ids)})
    assert response.status_code == 200
    body = response.json()
    assert [r["site_id"] for r in body["rows"]] == ids
    assert body["sample_count"] == 8761  # default: 2027 at 1 h
    assert {c["key"] for c in body["columns"]} >= set(ILLUMINATION_KEYS)
    row = body["rows"][0]
    for key in (
        "surface_height_m",
        "horizon_min_deg",
        "horizon_max_deg",
        "horizon_truncated_azimuths",
    ):
        cell = row[key]
        assert cell["value"] is not None, key
        assert cell["evidence"]["sources"][0]["source_id"] == "lola-ldem-75s-240m"
        assert cell["evidence"]["sources"][0]["sha256"]
    assert row["surface_height_m"]["evidence"]["kind"] == "derived_product"
    assert row["horizon_max_deg"]["evidence"]["kind"] == "calculation"
    assert row["horizon_truncated_azimuths"]["value"] == 0
    for key in ("slope_at_site_deg", "slope_p95_deg", "roughness_rms_m"):
        cell = row[key]
        assert cell["value"] is not None
        assert cell["baseline_m"] > 0
        assert cell["evidence"]["sources"][0]["source_id"] == "pgda-lola-20mpp-80s"
        assert "ETag" in cell["evidence"]["sources"][0]["version"]
        assert cell["limitations"]
    assert row["slope_at_site_deg"]["value"] == pytest.approx(SLOPE_DEG, abs=0.1)
    assert row["roughness_rms_m"]["baseline_m"] == 100.0  # default 50 m footprint
    for key in ILLUMINATION_KEYS:
        assert row[key]["value"] is None  # never 0
        assert row[key]["reason"].startswith(ILLUMINATION_UNAVAILABLE)


def test_uncomputable_cells_are_null_with_reason(compare_client: TestClient) -> None:
    far = compare_client.post(
        "/api/v1/sites", json={"name": "Far", "latitude_deg": -60.0, "longitude_deg": 0.0}
    ).json()["id"]
    row = compare_client.get(URL, params={"site_ids": far}).json()["rows"][0]
    assert row["surface_height_m"]["value"] is None
    assert "horizon mask not available" in row["surface_height_m"]["reason"]
    assert row["slope_at_site_deg"]["value"] is None
    assert "outside" in row["slope_at_site_deg"]["reason"]


def test_validation(compare_client: TestClient) -> None:
    ids = _sites(compare_client)
    assert compare_client.get(URL, params={"site_ids": "nope"}).status_code == 404
    assert compare_client.get(URL, params={"site_ids": ""}).status_code == 422
    too_many = compare_client.get(
        URL,
        params={
            "site_ids": ids[0],
            "start_utc": "2027-01-01T00:00:00Z",
            "end_utc": "2029-01-01T00:00:00Z",
        },
    )
    assert too_many.status_code == 422
    assert too_many.json()["error"]["details"][0]["type"] == "sample_cap_exceeded"
    order = compare_client.get(
        URL,
        params={
            "site_ids": ids[0],
            "start_utc": "2027-02-01T00:00:00Z",
            "end_utc": "2027-01-01T00:00:00Z",
        },
    )
    assert order.status_code == 422


@pytest.mark.skipif(
    os.environ.get("LUNARIS_NETWORK_TESTS") != "1", reason="set LUNARIS_NETWORK_TESTS=1"
)
def test_live_demo_trio_full_table() -> None:
    """Real LDEM + kernels + PGDA 20 m windows (network) for the catalogue demo trio."""
    data = Path(os.environ.get("LUNARIS_DATA_DIR", "data")).resolve()
    settings = Settings(environment="test", data_dir=data, log_level="WARNING")
    with TestClient(create_app(settings)) as client:
        trio = client.post("/api/v1/catalog/demo-trio/register").json()["sites"]
        ids = ",".join(s["id"] for s in trio)
        body = client.get(URL, params={"site_ids": ids}).json()
        assert len(body["rows"]) == 3
        for row in body["rows"]:
            for column in body["columns"]:
                cell = row[column["key"]]
                assert cell["value"] is not None, (row["name"], column["key"], cell["reason"])
                assert cell["evidence"]["sources"], (row["name"], column["key"])


def test_timeline_provider_maps_terrain_summaries() -> None:
    """The adapter takes the *terrain*-horizon summaries and states the period."""
    from types import SimpleNamespace  # noqa: PLC0415

    from lunaris_api.schemas.common import EvidenceSchema  # noqa: PLC0415
    from lunaris_api.services.compare import timeline_provider  # noqa: PLC0415

    ev = EvidenceSchema(kind="calculation", statement="t", method="m")
    sun = SimpleNamespace(
        mean_visible_disk_fraction=0.71,
        illuminated_fraction=0.83,
        longest_darkness_s=360000.0,
        longest_darkness_censored=True,
    )
    earth = SimpleNamespace(
        visible_fraction=0.42, longest_outage_s=1.2e6, longest_outage_censored=False
    )
    analysis = SimpleNamespace(
        terrain_horizon_available=True,
        sample_count=8761,
        illumination=SimpleNamespace(terrain=sun, evidence=ev, limitations=["L1"]),
        earth_visibility=SimpleNamespace(terrain=earth, evidence=ev, limitations=["no radio link"]),
    )
    fake = SimpleNamespace(timeline=lambda request: analysis)
    start, end = datetime(2027, 1, 1, tzinfo=UTC), datetime(2028, 1, 1, tzinfo=UTC)
    cells = timeline_provider(fake)("s1", start, end, 3600.0, 2.0)  # type: ignore[arg-type]
    assert cells["sun_mean_visible_disk_fraction"].value == 0.71
    assert cells["sun_illuminated_fraction"].value == 0.83
    assert cells["earth_visible_fraction"].value == 0.42
    assert cells["earth_longest_outage_s"].unit == "s"
    assert cells["sun_longest_hidden_s"].limitations[0].startswith("Period 2027-01-01")
    assert "lower bound" in cells["sun_longest_hidden_s"].limitations[-1]
    assert "no radio link" in cells["earth_visible_fraction"].limitations
    analysis.terrain_horizon_available = False
    cells = timeline_provider(fake)("s1", start, end, 3600.0, 2.0)  # type: ignore[arg-type]
    assert all(c.value is None and c.reason == ILLUMINATION_UNAVAILABLE for c in cells.values())
