"""Timelines baked to disk are served instead of recomputed.

Why it exists: on a small host (Render's free plan, 0.1 CPU) a cold year-long timeline costs
seconds and queues behind others, so the image build bakes the Compare default window and the
running API reads it. Needs the real kernels and LDEM, like the other terrain timeline tests.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from lunaris_api.services.illumination import TimelineService
from lunaris_api.settings import Settings
from tests.api.test_ephemeris import _create_site
from tests.api.test_timeline import DAY, URL, terrain_client  # noqa: F401

SITE01 = {"lat": -89.4632, "lon": 222.51}


def baked_files(settings: Settings) -> list[Path]:
    return sorted((settings.data_dir / "processed" / "timelines").glob("*.json.gz"))


def forbid_compute(monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("recomputed instead of reading the baked timeline")

    monkeypatch.setattr(TimelineService, "_compute", boom)


def test_a_baked_timeline_equals_a_fresh_one_and_is_not_recomputed(
    terrain_client: TestClient,  # noqa: F811
    settings: Settings,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings.bake_timelines = True
    site_id = _create_site(terrain_client, **SITE01)
    fresh = terrain_client.post(URL, json={"site_id": site_id, **DAY})
    assert fresh.status_code == 200, fresh.text
    assert len(baked_files(settings)) == 1

    forbid_compute(monkeypatch)
    again = terrain_client.post(URL, json={"site_id": site_id, **DAY})
    assert again.status_code == 200, again.text
    assert again.json() == fresh.json()


def test_a_baked_file_serves_any_registry_copy_of_the_site(
    terrain_client: TestClient,  # noqa: F811
    settings: Settings,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Site ids are generated per registry, so the file is keyed by coordinates, not by id: a
    timeline baked at image build serves the same site registered under another id and name."""
    settings.bake_timelines = True
    baked_for = _create_site(terrain_client, **SITE01)
    baked = terrain_client.post(URL, json={"site_id": baked_for, **DAY}).json()

    forbid_compute(monkeypatch)
    other = terrain_client.post(
        "/api/v1/sites",
        json={
            "name": "Same place, other name",
            "latitude_deg": SITE01["lat"],
            "longitude_deg": SITE01["lon"],
        },
    ).json()
    served = terrain_client.post(URL, json={"site_id": other["id"], **DAY}).json()
    assert served["site_id"] == other["id"] != baked["site_id"]
    assert served["site_name"] == "Same place, other name"
    assert {k: v for k, v in served.items() if k not in ("site_id", "site_name")} == {
        k: v for k, v in baked.items() if k not in ("site_id", "site_name")
    }


def test_running_requests_never_write_to_disk(
    terrain_client: TestClient,  # noqa: F811
    settings: Settings,
) -> None:
    assert settings.bake_timelines is False
    site_id = _create_site(terrain_client, **SITE01)
    assert terrain_client.post(URL, json={"site_id": site_id, **DAY}).status_code == 200
    assert baked_files(settings) == []


def test_a_different_step_or_place_is_a_different_file(
    terrain_client: TestClient,  # noqa: F811
    settings: Settings,
) -> None:
    settings.bake_timelines = True
    site_id = _create_site(terrain_client, **SITE01)
    other_site = _create_site(terrain_client, lat=-89.5, lon=10.0)
    for body in (
        {"site_id": site_id, **DAY},
        {"site_id": site_id, **DAY, "step_s": 7200},
        {"site_id": other_site, **DAY},
    ):
        assert terrain_client.post(URL, json=body).status_code == 200
    assert len(baked_files(settings)) == 3


def test_an_unreadable_baked_file_is_recomputed(
    terrain_client: TestClient,  # noqa: F811
    settings: Settings,
) -> None:
    settings.bake_timelines = True
    site_id = _create_site(terrain_client, **SITE01)
    fresh = terrain_client.post(URL, json={"site_id": site_id, **DAY}).json()
    (path,) = baked_files(settings)
    path.write_bytes(b"not gzip")
    again = terrain_client.post(URL, json={"site_id": site_id, **DAY})
    assert again.status_code == 200
    assert again.json()["illumination"] == fresh["illumination"]
    assert path.read_bytes() != b"not gzip"  # rewritten by this baking run
