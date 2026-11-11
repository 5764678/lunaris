"""Comparison summary: leaders, dominance, verdict, profiles (task T-18, D9)."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from lunaris_api.app import create_app
from lunaris_api.schemas.compare import CompareCell, CompareRow
from lunaris_api.services.compare import DIRECTED_COLUMNS
from lunaris_api.services.compare_summary import PROFILES, summarize
from lunaris_api.settings import Settings

URL = "/api/v1/analysis/site-comparison"
KEYS = [c.key for c in DIRECTED_COLUMNS]
UNITS = {c.key: c.unit for c in DIRECTED_COLUMNS}


def row(site_id: str, **values: float | None) -> CompareRow:
    """SYNTHETIC row: unspecified cells are null."""
    cells: dict[str, Any] = {
        k: CompareCell(value=values.get(k), unit=UNITS[k], reason=None if k in values else "n/a")
        for k in KEYS
    }
    return CompareRow(
        site_id=site_id,
        name=site_id.upper(),
        origin="published",
        latitude_deg=-89.0,
        longitude_deg=0.0,
        **cells,
    )


GOOD = {
    "slope_at_site_deg": 2.0,
    "slope_p95_deg": 3.0,
    "roughness_rms_m": 0.2,
    "sun_mean_visible_disk_fraction": 0.8,
    "sun_illuminated_fraction": 0.9,
    "sun_longest_hidden_s": 1e5,
    "earth_visible_fraction": 0.6,
    "earth_longest_outage_s": 1e5,
}
BAD = {
    "slope_at_site_deg": 6.0,
    "slope_p95_deg": 8.0,
    "roughness_rms_m": 0.6,
    "sun_mean_visible_disk_fraction": 0.4,
    "sun_illuminated_fraction": 0.5,
    "sun_longest_hidden_s": 2e6,
    "earth_visible_fraction": 0.3,
    "earth_longest_outage_s": 2e6,
}


def test_directions_are_declared_with_rationale() -> None:
    by = {c.key: c for c in DIRECTED_COLUMNS}
    assert by["sun_illuminated_fraction"].better == "higher"
    assert by["sun_longest_hidden_s"].better == "lower"
    assert by["slope_at_site_deg"].better == "lower"
    assert by["roughness_rms_m"].better == "lower"
    assert by["horizon_min_deg"].better is None
    assert by["horizon_max_deg"].better is None
    assert by["surface_height_m"].better is None
    assert all(c.better_rationale for c in DIRECTED_COLUMNS)


def test_known_dominance_and_verdict() -> None:
    summary = summarize([row("a", **GOOD), row("b", **BAD)], DIRECTED_COLUMNS)
    a, b = summary.sites
    assert len(a.leads) == 8
    assert a.trails == []
    assert a.dominated_by == []
    assert b.dominated_by == ["a"]
    assert len(b.trails) == 8
    assert a.dominance == "Best or tied on 8 of 8 measures; worst on none."
    assert "no better than A on any shared measure" in b.dominance
    assert summary.verdict.startswith("A is best or tied on every measure compared (8)")
    assert summary.score is None  # no profile → no score


def test_trade_off_and_no_clear_winner() -> None:
    a = {**GOOD, "roughness_rms_m": 0.9}  # better on everything but roughness
    one = summarize([row("a", **a), row("b", **BAD)], DIRECTED_COLUMNS)
    assert one.sites[0].trails == ["roughness_rms_m"]
    assert one.sites[0].dominated_by == []
    assert one.sites[1].dominated_by == []
    assert one.verdict.startswith("No single site is best on every measure")
    assert "worst on bumpiness" in one.verdict
    # A clear dominator with a tie still dominates.
    tie = summarize(
        [row("a", **{**GOOD, "roughness_rms_m": 0.6}), row("b", **BAD)], DIRECTED_COLUMNS
    )
    assert tie.sites[1].dominated_by == ["a"]
    rough = next(lead for lead in tie.leaders if lead.key == "roughness_rms_m")
    assert set(rough.site_ids) == {"a", "b"}  # tie → both lead
    assert "roughness_rms_m" not in tie.sites[1].trails  # tied best is not worst


def test_null_cells_never_win() -> None:
    a = {**BAD}
    b = {k: v for k, v in GOOD.items() if k != "sun_illuminated_fraction"}  # null there
    summary = summarize([row("a", **a), row("b", **b), row("c")], DIRECTED_COLUMNS)
    sunlit = next(lead for lead in summary.leaders if lead.key == "sun_illuminated_fraction")
    assert sunlit.site_ids == []  # only one non-null value: nothing to rank
    assert sunlit.compared_sites == 1
    c = summary.sites[2]
    assert c.leads == []
    assert c.trails == []
    assert c.directed_compared == 0
    assert c.dominated_by == []  # no shared values with anyone
    assert summary.sites[1].directed_compared == 7
    empty = summarize([row("x"), row("y")], DIRECTED_COLUMNS)
    assert empty.verdict.startswith("No measure has values for two or more sites")


def test_non_transitive_dominance_with_null_cells() -> None:
    """A dominates Y, Y dominates X (they share no roughness), X beats A on roughness."""
    a = {**GOOD, "roughness_rms_m": 0.5}
    y = {k: v for k, v in GOOD.items() if k != "roughness_rms_m"}
    y = {**y, "sun_illuminated_fraction": 0.85}  # A strictly better than Y here
    x = {**BAD, "roughness_rms_m": 0.1}  # X beats A on roughness only
    summary = summarize([row("a", **a), row("y", **y), row("x", **x)], DIRECTED_COLUMNS)
    st = {s.site_id: s for s in summary.sites}
    assert st["y"].dominated_by == ["a"]
    assert "y" in st["x"].dominated_by
    assert "a" not in st["x"].dominated_by
    assert st["a"].dominated_by == []
    # Only A is undominated, but A does not dominate X: no "A dominates" claim.
    assert "is ahead of" not in summary.verdict
    assert summary.verdict.startswith("No single site is best on every measure.")
    assert "X is no better than Y on any shared measure." in summary.verdict
    assert "Y is no better than A on any shared measure." in summary.verdict


def test_empty_front_is_stated_honestly() -> None:
    """A 3-cycle (possible only with null cells): every site is dominated."""
    # a vs b share only slope_at_site; b vs c share only slope_p95; c vs a share only roughness.
    a = {"slope_at_site_deg": 1.0, "roughness_rms_m": 0.9}
    b = {"slope_at_site_deg": 2.0, "slope_p95_deg": 1.0}
    c = {"slope_p95_deg": 2.0, "roughness_rms_m": 0.1}
    summary = summarize([row("a", **a), row("b", **b), row("c", **c)], DIRECTED_COLUMNS)
    assert all(s.dominated_by for s in summary.sites)
    assert summary.verdict.startswith("There is no clear winner")


@pytest.mark.parametrize("profile", ["power", "comms", "landing"])
def test_profile_ordering_and_assumption_evidence(profile: str) -> None:
    mid = {k: (GOOD[k] + BAD[k]) / 2 for k in GOOD}
    summary = summarize(
        [row("bad", **BAD), row("mid", **mid), row("good", **GOOD)],
        DIRECTED_COLUMNS,
        profile=profile,  # type: ignore[arg-type]
    )
    assert summary.score is not None
    assert [s.site_id for s in summary.score.scores] == ["good", "mid", "bad"]
    assert summary.score.scores[0].score == pytest.approx(1.0)
    assert summary.score.scores[1].score == pytest.approx(0.5)
    assert summary.score.scores[2].score == pytest.approx(0.0)
    assert summary.score.weights == PROFILES[profile]  # type: ignore[index]
    assert summary.score.evidence.kind == "assumption"
    assert any("weight" in a for a in summary.score.evidence.assumptions)
    assert "Min-max" in summary.score.normalisation


def test_profiles_pick_different_winners() -> None:
    sunny = {**BAD, **{k: GOOD[k] for k in PROFILES["power"]}}
    smooth = {**BAD, **{k: GOOD[k] for k in PROFILES["landing"]}}
    rows = [row("sunny", **sunny), row("smooth", **smooth)]
    assert summarize(rows, DIRECTED_COLUMNS, profile="power").score.scores[0].site_id == "sunny"  # type: ignore[union-attr]
    assert summarize(rows, DIRECTED_COLUMNS, profile="landing").score.scores[0].site_id == "smooth"  # type: ignore[union-attr]
    nulls = summarize([row("sunny", **sunny), row("none")], DIRECTED_COLUMNS, profile="power")
    assert nulls.score is not None
    assert nulls.score.scores[-1].score is None
    assert nulls.score.scores[-1].reason


REAL = Path(os.environ.get("LUNARIS_DATA_DIR", "data")).resolve()


@pytest.mark.skipif(
    os.environ.get("LUNARIS_NETWORK_TESTS") != "1", reason="set LUNARIS_NETWORK_TESTS=1"
)
def test_live_demo_trio_verdict_2027() -> None:
    """Real LDEM + kernels + PGDA: the trio over calendar 2027 at 1 h."""
    settings = Settings(environment="test", data_dir=REAL, log_level="WARNING")
    with TestClient(create_app(settings)) as client:
        trio = client.post("/api/v1/catalog/demo-trio/register").json()["sites"]
        body = client.get(URL, params={"site_ids": ",".join(s["id"] for s in trio)}).json()
        summary = body["summary"]
        by_name = {s["name"]: s for s in summary["sites"]}
        peak = by_name["Peak near Shackleton"]
        assert peak["trails"] == ["roughness_rms_m"]
        assert len(peak["leads"]) == 7
        assert peak["dominated_by"] == []
        assert "roughness_rms_m" in by_name["Malapert massif"]["leads"]
        assert summary["verdict"].startswith("No single site is best on every measure.")
        peak_part = (
            "Peak near Shackleton leads on slope, sunlight and darkness and Earth visibility"
        )
        assert peak_part + "; trade-off: worst on roughness." in summary["verdict"]
        assert summary["score"] is None
        power = client.get(
            URL, params={"site_ids": ",".join(s["id"] for s in trio), "profile": "power"}
        ).json()["summary"]["score"]
        assert power["scores"][0]["name"] == "Peak near Shackleton"
        print("\nverdict:", summary["verdict"])
