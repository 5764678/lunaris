"""Cited site catalogue API (task T-03, API half)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from lunaris_data.catalogs.sites import load_site_catalog

DEMO = {"pgda78-site01", "pgda78-site23", "pgda78-site07"}


def test_catalog_lists_cited_sites_with_definition(client: TestClient) -> None:
    body = client.get("/api/v1/catalog/sites").json()
    assert body["count"] == 27
    assert len(body["sites"]) == 27
    assert "NOT a selected landing point" in body["reference_point_definition"]
    assert body["evidence_kind"] == "derived_product"
    assert body["sources"]
    assert all(s["url"].startswith("https://") for s in body["sources"])
    assert "doi:10.1016/j.pss.2020.105119" in body["citation"]
    assert {s["id"] for s in body["sites"] if s["demo_trio"]} == DEMO
    ridge = next(s for s in body["sites"] if s["id"] == "pgda78-site01")
    assert ridge["reference_point"] == {
        "latitude_deg": -89.4632,
        "longitude_deg": 222.51,
        "frame": "MOON_ME",
    }
    assert ridge["register_url"] == "/api/v1/catalog/sites/pgda78-site01/register"


def test_register_one_catalog_site_as_published(client: TestClient) -> None:
    response = client.post("/api/v1/catalog/sites/pgda78-site23/register")
    assert response.status_code == 201
    site = response.json()
    assert site["origin"] == "published"
    assert site["name"] == "Malapert massif"
    assert "Barker, M. K., et al. (2021)" in site["reference"]
    assert "tile Site23" in site["reference"]
    assert "NOT a selected landing point" in site["notes"]
    entry = load_site_catalog().site("pgda78-site23")
    assert site["coordinate"]["latitude_deg"] == entry.reference_point.latitude_deg
    assumptions = site["body_fixed_position"]["evidence"]["assumptions"]
    assert any("published catalogue reference point" in a for a in assumptions)
    # Listed in the registry with its origin; second registration conflicts.
    listed = client.get("/api/v1/sites").json()["sites"]
    assert [s["origin"] for s in listed] == ["published"]
    assert client.post("/api/v1/catalog/sites/pgda78-site23/register").status_code == 409
    assert client.post("/api/v1/catalog/sites/no-such-site/register").status_code == 404


def test_demo_trio_in_one_action_is_idempotent(client: TestClient) -> None:
    first = client.post("/api/v1/catalog/demo-trio/register")
    assert first.status_code == 200
    body = first.json()
    assert set(body["created"]) == DEMO
    assert body["already_registered"] == []
    assert {s["origin"] for s in body["sites"]} == {"published"}
    again = client.post("/api/v1/catalog/demo-trio/register").json()
    assert again["created"] == []
    assert set(again["already_registered"]) == DEMO
    assert client.get("/api/v1/sites").json()["count"] == 3


def test_user_defined_sites_keep_their_origin(client: TestClient) -> None:
    site = client.post(
        "/api/v1/sites", json={"name": "Mine", "latitude_deg": -89.0, "longitude_deg": 10.0}
    ).json()
    assert site["origin"] == "user_defined"
    assumptions = site["body_fixed_position"]["evidence"]["assumptions"]
    assert any("user-defined" in a for a in assumptions)
