"""Cited site catalogue API (task T-03, API half)."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from lunaris_api.app import create_app
from lunaris_api.settings import Settings
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


def test_seeding_registers_all_27_cited_sites_once(tmp_path: Path) -> None:
    settings = Settings(
        environment="test",
        data_dir=tmp_path / "data",
        log_level="WARNING",
        seed_catalog=True,
    )
    with TestClient(create_app(settings)) as seeded:
        sites = seeded.get("/api/v1/sites").json()["sites"]
        assert len(sites) == 27
        assert {s["origin"] for s in sites} == {"published"}
        names = [s["name"] for s in sites]
        assert len(set(names)) == 27
        # PGDA labels two tiles "de Gerlache rim": each carries its tile id so both register.
        assert {n for n in names if n.startswith("de Gerlache rim")} == {
            "de Gerlache rim (SL2)",
            "de Gerlache rim (Site11)",
        }
        assert {"Malapert massif", "Peak near Shackleton", "Connecting ridge"} <= set(names)
        # Registering again (the demo trio, or a restart) adds nothing.
        again = seeded.post("/api/v1/catalog/demo-trio/register").json()
        assert again["created"] == []
        assert len(again["already_registered"]) == 3
        assert len(seeded.get("/api/v1/sites").json()["sites"]) == 27
    with TestClient(create_app(settings)) as restarted:
        assert len(restarted.get("/api/v1/sites").json()["sites"]) == 27


def test_every_catalogue_site_can_be_registered_one_by_one(client: TestClient) -> None:
    """The two tiles PGDA both calls "de Gerlache rim" no longer collide."""
    for entry in load_site_catalog().sites:
        response = client.post(f"/api/v1/catalog/sites/{entry.id}/register")
        assert response.status_code == 201, (entry.id, response.text)
    assert len(client.get("/api/v1/sites").json()["sites"]) == 27
