"""Comparison summary: leaders, dominance, verdict, mission recommendation (task T-18, D9)."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from lunaris_api.app import create_app
from lunaris_api.schemas.compare import (
    CompareCell,
    CompareRow,
    Mission,
    MissionLimits,
    Recommendation,
)
from lunaris_api.services.compare import DIRECTED_COLUMNS
from lunaris_api.services.compare_recommend import (
    CENSORED_NOTE,
    NEED_COLUMNS,
    column_weights,
    recommend,
)
from lunaris_api.services.compare_summary import summarize
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
    assert summary.recommendation.mission == Mission()  # default mission: all important


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


# ── mission recommendation ───────────────────────────────────────────────────────────────
DAY = 86_400.0


def site(
    site_id: str, *, sun: float, earth: float, slope: float, **extra: float | None
) -> CompareRow:
    """SYNTHETIC full row from three dials: sunlight, Earth visibility (fractions), slope (deg)."""
    values: dict[str, float | None] = {
        "sun_mean_visible_disk_fraction": sun,
        "sun_illuminated_fraction": sun,
        "sun_longest_hidden_s": (1 - sun) * 20 * DAY,
        "sun_longest_visible_s": sun * 30 * DAY,
        "earth_visible_fraction": earth,
        "earth_longest_outage_s": (1 - earth) * 20 * DAY,
        "slope_at_site_deg": slope,
        "slope_p95_deg": slope + 1,
        "roughness_rms_m": 0.3,
    }
    return row(site_id, **{**values, **extra})


SUNNY = {"sun": 0.9, "earth": 0.5, "slope": 9.0}  # best light, steepest
FLAT = {"sun": 0.3, "earth": 0.5, "slope": 1.0}  # gentlest, darkest


def pick(rows: list[CompareRow], mission: Mission | None = None) -> Recommendation:
    return recommend(rows, DIRECTED_COLUMNS, mission or Mission())


def test_a_trade_off_still_gets_a_named_recommendation() -> None:
    rows = [site("sunny", **SUNNY), site("flat", **FLAT)]
    summary = summarize(rows, DIRECTED_COLUMNS)
    assert summary.verdict.startswith("No single site is best on every measure")
    rec = summary.recommendation
    assert rec.site_id == "sunny"
    assert rec.confidence == "clear"
    assert rec.headline.startswith("SUNNY is the best fit for this mission")
    assert rec.runner_up_site_id == "flat"
    assert rec.ranking[0].score is not None
    assert rec.ranking[1].score is not None
    assert rec.margin == pytest.approx(rec.ranking[0].score - rec.ranking[1].score)
    assert [e.status for e in rec.ranking] == ["recommended", "ranked"]
    assert any("Sunlight and power" in r and "best of the 2" in r for r in rec.reasons)
    assert any("Landing safety" in t and "behind FLAT" in t for t in rec.tradeoffs)


def test_the_mission_answers_decide_the_pick() -> None:
    rows = [site("sunny", **SUNNY), site("flat", **FLAT)]
    solar = pick(rows, Mission(power="high", comms="none", landing="low"))
    nuclear = pick(rows, Mission(power="none", comms="none", landing="high"))
    assert solar.site_id == "sunny"
    assert nuclear.site_id == "flat"


def test_weights_follow_the_priorities_and_are_shown_as_assumptions() -> None:
    mission = Mission(power="high", comms="low", landing="medium")
    rec = pick([site("a", **SUNNY), site("b", **FLAT)], mission)
    assert {n.need: n.weight for n in rec.needs} == pytest.approx(
        {"power": 4 / 7, "comms": 1 / 7, "landing": 2 / 7}
    )
    assert sum(column_weights(mission).values()) == pytest.approx(1.0)
    assert sum(s.weight for s in rec.scales) == pytest.approx(1.0)
    assert {s.key for s in rec.scales} == {k for cols in NEED_COLUMNS.values() for k in cols}
    assert rec.evidence.kind == "assumption"
    assert any("weight" in a and "scale" in a for a in rec.evidence.assumptions)


def test_a_score_does_not_depend_on_which_other_sites_are_compared() -> None:
    a, b = site("a", **SUNNY), site("b", **FLAT)
    outlier = site("c", sun=0.01, earth=0.0, slope=30.0)
    two = {e.site_id: e.score for e in pick([a, b]).ranking}
    three = {e.site_id: e.score for e in pick([a, b, outlier]).ranking}
    assert three["a"] == two["a"]
    assert three["b"] == two["b"]
    assert pick([a, b, outlier]).site_id == pick([a, b]).site_id


def test_a_site_over_a_limit_is_excluded_with_the_reason_not_down_weighted() -> None:
    rows = [site("sunny", **SUNNY), site("flat", **FLAT)]
    rec = pick(rows, Mission(limits=MissionLimits(max_slope_deg=5)))
    assert rec.site_id == "flat"
    assert rec.confidence == "only_option"
    assert "only compared site that meets the mission limits" in rec.headline
    out = next(e for e in rec.ranking if e.site_id == "sunny")
    assert out.status == "excluded"
    assert out.score is None
    assert out.rank is None
    assert out.reasons == [
        "slope at the site 9.0° is over the 5° limit",
        "footprint slope (p95) 10.0° is over the 5° limit",
    ]


def test_when_every_site_breaks_a_limit_the_nearest_miss_is_named() -> None:
    rows = [
        site("far", sun=0.2, earth=0.5, slope=2.0),
        site("near", sun=0.8, earth=0.5, slope=2.0),
    ]
    rec = pick(rows, Mission(limits=MissionLimits(max_darkness_d=1)))
    assert rec.site_id is None
    assert rec.confidence == "none"
    assert rec.headline.startswith("No compared site meets the mission limits. Closest is NEAR")
    assert [e.site_id for e in rec.ranking] == ["near", "far"]


def test_a_limit_on_a_missing_value_excludes_the_site() -> None:
    rows = [site("a", **SUNNY), site("b", **FLAT, sun_longest_visible_s=None)]
    rec = pick(rows, Mission(limits=MissionLimits(min_sunlit_d=5)))
    b = next(e for e in rec.ranking if e.site_id == "b")
    assert b.status == "excluded"
    assert "cannot be checked" in b.reasons[0]


def test_a_limit_met_only_as_a_lower_bound_is_flagged() -> None:
    a, b = site("a", **SUNNY), site("b", **FLAT)
    a = a.model_copy(
        update={
            "sun_longest_hidden_s": a.sun_longest_hidden_s.model_copy(
                update={"limitations": [CENSORED_NOTE]}
            )
        }
    )
    rec = pick([a, b], Mission(limits=MissionLimits(max_darkness_d=15)))
    assert rec.site_id == "a"
    assert len(rec.caveats) == 1
    assert "lower bound" in rec.caveats[0]


def test_a_missing_weighted_value_means_no_score_not_zero() -> None:
    rows = [site("a", **FLAT), site("b", **SUNNY, roughness_rms_m=None)]
    b = next(e for e in pick(rows).ranking if e.site_id == "b")
    assert b.status == "unscored"
    assert b.score is None
    assert "roughness" in b.reasons[0]
    assert "landing" not in b.need_scores
    assert "power" in b.need_scores
    # With landing safety not needed, the missing roughness no longer matters.
    rec = pick(rows, Mission(landing="none"))
    assert rec.site_id == "b"
    assert all(e.score is not None for e in rec.ranking)


def test_equal_sites_are_reported_as_a_tie() -> None:
    rec = pick([site("a", **SUNNY), site("b", **SUNNY), site("c", **FLAT)])
    assert rec.confidence == "tie"
    assert rec.margin == 0
    assert rec.headline.startswith("A and B score the same")
    assert [e.rank for e in rec.ranking] == [1, 1, 3]


def test_no_need_weighted_means_no_pick() -> None:
    rec = pick(
        [site("a", **SUNNY), site("b", **FLAT)],
        Mission(power="none", comms="none", landing="none"),
    )
    assert rec.site_id is None
    assert rec.confidence == "none"
    assert "Raise at least one priority" in rec.headline


def test_one_site_is_scored_but_not_called_a_recommendation() -> None:
    rec = pick([site("a", **SUNNY)])
    assert rec.confidence == "only_option"
    assert rec.headline.startswith("Only one site is selected")
    assert rec.robustness is None


def test_robustness_reports_the_priority_change_that_flips_the_pick() -> None:
    rows = [site("sunny", **SUNNY), site("flat", **FLAT)]
    stable = pick(rows, Mission(power="high", comms="none", landing="none")).robustness
    assert stable is not None
    assert stable.flips == []
    assert stable.statement.startswith("Stable")
    edge = pick(rows, Mission(power="low", comms="none", landing="medium"))
    assert edge.site_id == "flat"
    assert edge.robustness is not None
    assert edge.robustness.held < edge.robustness.tested
    flips = {f.change: f.name for f in edge.robustness.flips}
    assert flips["Sunlight and power set to important"] == "SUNNY"


def test_longest_sunlit_period_is_a_directed_column() -> None:
    by = {c.key: c for c in DIRECTED_COLUMNS}
    assert by["sun_longest_visible_s"].better == "higher"


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
        assert peak_part + "; trade-off: worst on bumpiness." in summary["verdict"]
        ids = ",".join(s["id"] for s in trio)

        def recommendation(**mission: str | float) -> dict[str, Any]:
            body = client.get(URL, params={"site_ids": ids, **mission}).json()
            result: dict[str, Any] = body["summary"]["recommendation"]
            return result

        # Default mission (every need important): a named pick despite the trade-off.
        default = summary["recommendation"]
        assert default["name"] == "Peak near Shackleton"
        assert default["confidence"] == "clear"
        assert [(e["name"], round(e["score"], 3)) for e in default["ranking"]] == [
            ("Peak near Shackleton", 0.713),
            ("Connecting ridge", 0.582),
            ("Malapert massif", 0.504),
        ]
        # Only landing safety matters: Malapert (smoothest) edges ahead, narrowly.
        landing = recommendation(power="none", comms="none", landing="high")
        assert landing["name"] == "Malapert massif"
        assert landing["confidence"] == "narrow"
        assert [round(e["score"], 3) for e in landing["ranking"]] == [0.705, 0.692, 0.638]
        # A slope limit excludes sites with the reason instead of down-weighting them.
        limited = recommendation(max_slope_deg=5)
        assert limited["name"] == "Peak near Shackleton"
        assert limited["confidence"] == "only_option"
        assert {e["name"] for e in limited["ranking"] if e["status"] == "excluded"} == {
            "Connecting ridge",
            "Malapert massif",
        }
        print("\nverdict:", summary["verdict"])
