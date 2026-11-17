"""App-level compare row cache. SYNTHETIC LDEM + synthetic PGDA window (see test_compare)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient

from lunaris_api import dependencies
from lunaris_api.errors import ApiError
from lunaris_api.schemas.common import EvidenceSchema
from lunaris_api.schemas.compare import CompareCell
from lunaris_api.services import terrain as terrain_service
from lunaris_api.services.compare import COLUMNS, ILLUMINATION_KEYS, RowCache
from lunaris_data.remote.window import RemoteWindowError
from tests.api.test_compare import URL, _sites, compare_client  # noqa: F401 (fixture)

UNITS = {c.key: c.unit for c in COLUMNS}


class UnavailableError(ApiError):
    status_code = 503
    code = "dataset_unavailable"


class CountingProvider:
    """SYNTHETIC illumination cells; counts calls and can fail transiently."""

    def __init__(self) -> None:
        self.calls = 0
        self.fail_next = 0

    def __call__(
        self, site_id: str, start: datetime, end: datetime, step_s: float, observer_h: float
    ) -> dict[str, CompareCell]:
        self.calls += 1
        if self.fail_next:
            self.fail_next -= 1
            raise UnavailableError("ephemeris service unreachable")
        ev = EvidenceSchema(kind="calculation", statement="SYNTHETIC test fixture", method="m")
        value = 0.5 + 0.1 * (hash(site_id) % 4)
        return {k: CompareCell(value=value, unit=UNITS[k], evidence=ev) for k in ILLUMINATION_KEYS}


@pytest.fixture
def provider(monkeypatch: pytest.MonkeyPatch) -> CountingProvider:
    counting = CountingProvider()
    monkeypatch.setattr(dependencies, "timeline_provider", lambda timelines: counting)
    return counting


@pytest.fixture
def client(compare_client: TestClient, provider: CountingProvider) -> TestClient:  # noqa: F811
    del provider
    return compare_client


def _get(client: TestClient, ids: list[str], **params: Any) -> dict[str, Any]:
    response = client.get(URL, params={"site_ids": ",".join(ids), **params})
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


def test_identical_compare_reuses_rows(client: TestClient, provider: CountingProvider) -> None:
    ids = _sites(client)
    first = _get(client, ids)
    assert provider.calls == 3
    second = _get(client, ids)
    assert provider.calls == 3  # no new illumination computation
    assert second == first  # same response, row for row
    # A subset (the page's per-site requests, then the all-sites summary) hits too.
    _get(client, ids[:1])
    assert provider.calls == 3


@pytest.mark.parametrize(
    "change",
    [
        {"step_s": 7200},
        {"footprint_radius_m": 80},
        {"observer_height_m": 5},
        {"start_utc": "2027-02-01T00:00:00Z"},
        {"end_utc": "2027-12-01T00:00:00Z"},
    ],
)
def test_any_key_field_recomputes(
    client: TestClient, provider: CountingProvider, change: dict[str, Any]
) -> None:
    ids = _sites(client)[:1]
    _get(client, ids)
    assert provider.calls == 1
    _get(client, ids, **change)
    assert provider.calls == 2


def test_moved_site_recomputes_and_identity_is_current(
    client: TestClient, provider: CountingProvider
) -> None:
    ids = _sites(client)[:1]
    _get(client, ids)
    other = client.post(
        "/api/v1/sites", json={"name": "Moved", "latitude_deg": -89.4, "longitude_deg": 45.0}
    ).json()["id"]
    _get(client, [other])
    assert provider.calls == 2  # a different site (coordinates) is a different row


def test_transient_illumination_failure_is_not_cached(
    client: TestClient, provider: CountingProvider
) -> None:
    ids = _sites(client)[:1]
    provider.fail_next = 1
    row = _get(client, ids)["rows"][0]
    assert row["sun_illuminated_fraction"]["value"] is None
    assert "unreachable" in row["sun_illuminated_fraction"]["reason"]
    row = _get(client, ids)["rows"][0]  # recovered: computed again, not frozen
    assert provider.calls == 2
    assert row["sun_illuminated_fraction"]["value"] is not None
    _get(client, ids)
    assert provider.calls == 2  # the good row is cached


def test_transient_terrain_failure_is_not_cached(
    client: TestClient, provider: CountingProvider, monkeypatch: pytest.MonkeyPatch
) -> None:
    ids = _sites(client)[:1]
    working = terrain_service.read_window

    def unreachable(*args: Any, **kwargs: Any) -> Any:
        raise RemoteWindowError("HTTP 503 from pgda.gsfc.nasa.gov")

    monkeypatch.setattr(terrain_service, "read_window", unreachable)
    row = _get(client, ids)["rows"][0]
    assert row["slope_at_site_deg"]["value"] is None
    monkeypatch.setattr(terrain_service, "read_window", working)
    row = _get(client, ids)["rows"][0]
    assert row["slope_at_site_deg"]["value"] is not None
    assert provider.calls == 2


def test_deterministic_nulls_are_cached(client: TestClient, provider: CountingProvider) -> None:
    far = client.post(
        "/api/v1/sites", json={"name": "Far", "latitude_deg": -60.0, "longitude_deg": 0.0}
    ).json()["id"]
    row = _get(client, [far])["rows"][0]
    assert row["slope_at_site_deg"]["value"] is None  # outside PGDA coverage (422)
    _get(client, [far])
    assert provider.calls == 1


def test_mission_answers_reuse_rows(client: TestClient, provider: CountingProvider) -> None:
    ids = _sites(client)
    plain = _get(client, ids)
    assert plain["summary"]["recommendation"]["mission"]["power"] == "medium"
    for power, comms, landing in (("high", "none", "none"), ("none", "high", "none")):
        body = _get(client, ids, power=power, comms=comms, landing=landing)
        assert body["rows"] == plain["rows"]
        assert body["summary"]["recommendation"]["mission"]["power"] == power
    assert provider.calls == 3  # only the first request computed rows
    assert _get(client, ids)["summary"] == plain["summary"]


def test_row_cache_is_a_bounded_lru() -> None:
    start, end = datetime(2027, 1, 1, tzinfo=UTC), datetime(2028, 1, 1, tzinfo=UTC)
    cache = RowCache(max_rows=2)
    a, b, c = (("s", float(i), 0.0, start, end, 1.0, 2.0, 50.0) for i in range(3))
    cache.put(a, {})
    cache.put(b, {})
    assert cache.get(a) == {}  # a is now most recent
    cache.put(c, {})
    assert cache.get(b) is None  # least recently used was evicted
    assert cache.get(a) == {}
    assert cache.get(c) == {}
    assert len(cache) == 2
    with pytest.raises(ValueError, match="max_rows"):
        RowCache(max_rows=0)
