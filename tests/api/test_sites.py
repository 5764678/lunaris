"""Candidate site registry: validation, normalization, persistence, evidence."""

from __future__ import annotations

import math

import pytest
from fastapi.testclient import TestClient

from lunaris_api.app import create_app
from lunaris_api.services import sites as site_service
from lunaris_api.settings import Settings

R = 1_737_400.0


def _create(client: TestClient, **overrides: object) -> dict[str, object]:
    payload = {"name": "Ridge A", "latitude_deg": -89.45, "longitude_deg": -137.31}
    payload.update(overrides)
    response = client.post("/api/v1/sites", json=payload)
    assert response.status_code == 201, response.text
    body: dict[str, object] = response.json()
    return body


def test_site_lifecycle(client: TestClient) -> None:
    assert client.get("/api/v1/sites").json() == {
        "sites": [],
        "count": 0,
        "limit": site_service.MAX_SITES,
    }
    created = _create(client, reference="user note", notes="  padded  ")
    site_id = created["id"]
    assert created["origin"] == "user_defined"
    assert created["notes"] == "padded"
    assert created["coordinate"] == {
        "latitude_deg": -89.45,
        "longitude_deg": pytest.approx(222.69),
        "frame": "MOON_ME",
    }

    listed = client.get("/api/v1/sites").json()
    assert listed["count"] == 1
    assert listed["sites"][0]["id"] == site_id
    assert client.get(f"/api/v1/sites/{site_id}").json()["name"] == "Ridge A"

    assert client.delete(f"/api/v1/sites/{site_id}").status_code == 204
    assert client.get(f"/api/v1/sites/{site_id}").status_code == 404
    assert client.delete(f"/api/v1/sites/{site_id}").status_code == 404


def test_sites_persist_across_app_restarts(client: TestClient, settings: Settings) -> None:
    _create(client, name="Persistent")
    with TestClient(create_app(settings)) as second:
        names = [s["name"] for s in second.get("/api/v1/sites").json()["sites"]]
    assert names == ["Persistent"]


def test_body_fixed_position_is_a_labeled_calculation(client: TestClient) -> None:
    site = _create(client, latitude_deg=0.0, longitude_deg=90.0)
    position = site["body_fixed_position"]
    assert isinstance(position, dict)
    assert position["x_m"] == pytest.approx(0.0, abs=1e-6)
    assert position["y_m"] == pytest.approx(R)
    assert position["z_m"] == pytest.approx(0.0, abs=1e-6)
    evidence = position["evidence"]
    assert evidence["kind"] == "calculation"
    assert evidence["method"]
    assert any("h = 0 m" in a for a in evidence["assumptions"])
    assert evidence["sources"]


def test_south_pole_position(client: TestClient) -> None:
    position = _create(client, latitude_deg=-90.0, longitude_deg=0.0)["body_fixed_position"]
    assert isinstance(position, dict)
    assert math.hypot(position["x_m"], position["y_m"]) == pytest.approx(0.0, abs=1e-6)
    assert position["z_m"] == pytest.approx(-R)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("latitude_deg", 90.5),
        ("latitude_deg", -91),
        ("longitude_deg", 360.5),
        ("longitude_deg", -181),
        ("latitude_deg", "NaN"),
        ("longitude_deg", "Infinity"),
        ("name", ""),
        ("name", "   "),
        ("name", "x" * 81),
        ("name", "line\nbreak"),
        ("notes", "n" * 1001),
    ],
)
def test_invalid_payloads_rejected(client: TestClient, field: str, value: object) -> None:
    payload: dict[str, object] = {"name": "Valid", "latitude_deg": -89.0, "longitude_deg": 10.0}
    payload[field] = value
    response = client.post("/api/v1/sites", json=payload)
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["details"][0]["location"][:2] == ["body", field]


def test_unknown_fields_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/v1/sites",
        json={"name": "A", "latitude_deg": 0, "longitude_deg": 0, "elevation_m": 12},
    )
    assert response.status_code == 422


def test_duplicate_names_conflict_case_insensitively(client: TestClient) -> None:
    _create(client, name="Shackleton Rim Test")
    response = client.post(
        "/api/v1/sites",
        json={"name": "shackleton   RIM test", "latitude_deg": -89, "longitude_deg": 0},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "conflict"


def test_registry_limit(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(site_service, "MAX_SITES", 1)
    _create(client, name="Only")
    response = client.post(
        "/api/v1/sites", json={"name": "Second", "latitude_deg": 0, "longitude_deg": 0}
    )
    assert response.status_code == 409


def test_invalid_site_id_path(client: TestClient) -> None:
    assert client.get("/api/v1/sites/not%20valid").status_code == 422
