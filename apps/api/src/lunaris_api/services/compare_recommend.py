"""Mission recommendation: which compared site fits the stated mission best, and why.

The Pareto verdict (``compare_summary``) can only say "no site is best on everything" as soon
as two sites trade off. A mission does not weigh everything equally, so this module asks what
the mission needs and then always names a site when one qualifies:

1. **Limits first.** A site that breaks a stated limit (slope, darkness, Earth outage,
   continuous sunlight) is excluded with the reason. It is never just down-weighted. A site
   whose limited measure has no value cannot be checked and is excluded too.
2. **Score on fixed scales.** Each scored measure maps to 0..1 on a fixed reference scale
   (``SCALES``), so a site's score depends only on its own values: adding or removing another
   site never changes it, and one outlier cannot flatten the differences between the others.
3. **Weights from the answers.** Each need (power, comms, landing) gets a priority; the
   priority weights (``PRIORITY_WEIGHT``) are normalised to shares of the score. Within a
   need the measure weights are fixed (``NEED_COLUMNS``).
4. **Say how sure.** The lead over the runner-up gives a confidence label, and the pick is
   re-run with each priority moved one step up and down to report whether it would change.

Every weight, scale and threshold is returned as ``assumption`` evidence. A site with a null
cell in a weighted measure has no score (never 0). The module is pure: rows in, result out.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from lunaris_api.schemas.common import EvidenceSchema
from lunaris_api.schemas.compare import (
    CompareCell,
    CompareColumn,
    CompareRow,
    Confidence,
    Mission,
    Need,
    NeedInfo,
    Priority,
    RankedSite,
    Recommendation,
    Robustness,
    RobustnessFlip,
    ScaleInfo,
)

CENSORED_NOTE = "Longest run touches the window edge: a lower bound."
DAY_S = 86_400.0
SYNODIC_MONTH_S = 29.530589 * DAY_S

NEEDS: tuple[Need, ...] = ("power", "comms", "landing")
NEED_LABEL: dict[Need, str] = {
    "power": "Sunlight and power",
    "comms": "Direct-to-Earth comms",
    "landing": "Landing safety",
}
PRIORITIES: tuple[Priority, ...] = ("none", "low", "medium", "high")
PRIORITY_WEIGHT: dict[Priority, float] = {"none": 0.0, "low": 1.0, "medium": 2.0, "high": 4.0}
PRIORITY_LABEL: dict[Priority, str] = {
    "none": "not needed",
    "low": "nice to have",
    "medium": "important",
    "high": "critical",
}

# Weights of the measures inside each need (each need sums to 1).
NEED_COLUMNS: dict[Need, dict[str, float]] = {
    "power": {
        "sun_mean_visible_disk_fraction": 0.4,
        "sun_illuminated_fraction": 0.2,
        "sun_longest_hidden_s": 0.4,
    },
    "comms": {"earth_visible_fraction": 0.6, "earth_longest_outage_s": 0.4},
    "landing": {"slope_at_site_deg": 0.3, "slope_p95_deg": 0.4, "roughness_rms_m": 0.3},
}


@dataclass(frozen=True)
class Scale:
    worst: float  # scores 0 (and anything beyond it)
    best: float  # scores 1
    rationale: str


SCALES: dict[str, Scale] = {
    "slope_at_site_deg": Scale(
        20.0, 0.0, "0° scores 1; 20° or steeper scores 0 (assumed beyond any lander's tolerance)."
    ),
    "slope_p95_deg": Scale(
        20.0, 0.0, "0° scores 1; 20° or steeper scores 0 (assumed beyond any lander's tolerance)."
    ),
    "roughness_rms_m": Scale(
        1.0, 0.0, "0 m scores 1; 1 m RMS or rougher scores 0. Holds for the default footprint only."
    ),
    "sun_mean_visible_disk_fraction": Scale(0.0, 1.0, "The fraction itself."),
    "sun_illuminated_fraction": Scale(0.0, 1.0, "The fraction itself."),
    "sun_longest_hidden_s": Scale(
        SYNODIC_MONTH_S,
        0.0,
        "No darkness scores 1; one synodic month (29.53 d) or longer in the dark scores 0.",
    ),
    "earth_visible_fraction": Scale(0.0, 1.0, "The fraction itself."),
    "earth_longest_outage_s": Scale(
        SYNODIC_MONTH_S,
        0.0,
        "No outage scores 1; one synodic month (29.53 d) or longer without Earth scores 0.",
    ),
}


@dataclass(frozen=True)
class Limit:
    field: str  # attribute of MissionLimits
    keys: tuple[str, ...]  # measures that must all satisfy it
    kind: str  # "max" or "min"
    per_unit: float  # measure units per limit unit (seconds per day)
    unit: str


LIMITS: tuple[Limit, ...] = (
    Limit("max_slope_deg", ("slope_at_site_deg", "slope_p95_deg"), "max", 1.0, "°"),
    Limit("max_darkness_d", ("sun_longest_hidden_s",), "max", DAY_S, " d"),
    Limit("max_earth_outage_d", ("earth_longest_outage_s",), "max", DAY_S, " d"),
    Limit("min_sunlit_d", ("sun_longest_visible_s",), "min", DAY_S, " d"),
)

NAMES: dict[str, str] = {
    "slope_at_site_deg": "slope at the site",
    "slope_p95_deg": "footprint slope (p95)",
    "roughness_rms_m": "roughness",
    "sun_mean_visible_disk_fraction": "mean visible solar disc",
    "sun_illuminated_fraction": "sunlit time",
    "sun_longest_hidden_s": "longest darkness",
    "sun_longest_visible_s": "longest sunlit period",
    "earth_visible_fraction": "Earth in view",
    "earth_longest_outage_s": "longest Earth outage",
}

CLEAR_MARGIN = 0.05
MODERATE_MARGIN = 0.02
_TIE = 1e-9
_UNCHECKED = 1e6  # a limit that cannot be checked counts as the farthest miss

METHOD = (
    "1. Sites that break a mission limit are excluded (a null value cannot be checked and is "
    "excluded too). 2. Each scored measure maps linearly to 0..1 on a fixed reference scale, "
    "clamped at both ends. 3. A need's score is the weighted mean of its measures; the "
    "mission score is the weighted mean of the needs, with weights from the priorities "
    "(not needed 0, nice to have 1, important 2, critical 4, normalised to sum to 1). "
    "4. The highest score is recommended; the lead over the runner-up is called clear from "
    f"{CLEAR_MARGIN * 100:g} points of 100, moderate from {MODERATE_MARGIN * 100:g}, else narrow. "
    "5. The pick is recomputed with each priority moved one step down and one step up."
)


def need_shares(mission: Mission) -> dict[Need, float]:
    raw = {need: PRIORITY_WEIGHT[getattr(mission, need)] for need in NEEDS}
    total = sum(raw.values())
    return {need: (w / total if total else 0.0) for need, w in raw.items()}


def column_weights(mission: Mission) -> dict[str, float]:
    """Share of the mission score carried by each measure (sums to 1 unless nothing matters)."""
    shares = need_shares(mission)
    return {
        key: shares[need] * weight for need in NEEDS for key, weight in NEED_COLUMNS[need].items()
    }


def _cell(row: CompareRow, key: str) -> CompareCell | None:
    cell = getattr(row, key, None)
    return cell if isinstance(cell, CompareCell) else None


def _value(row: CompareRow, key: str) -> float | None:
    cell = _cell(row, key)
    return cell.value if cell is not None else None


def _censored(row: CompareRow, key: str) -> bool:
    cell = _cell(row, key)
    return cell is not None and CENSORED_NOTE in cell.limitations


def utility(key: str, value: float) -> float:
    scale = SCALES[key]
    return min(1.0, max(0.0, (value - scale.worst) / (scale.best - scale.worst)))


def need_scores(row: CompareRow) -> dict[str, float]:
    """0..1 per need; a need with a null measure has no score."""
    out: dict[str, float] = {}
    for need in NEEDS:
        total = 0.0
        for key, weight in NEED_COLUMNS[need].items():
            value = _value(row, key)
            if value is None:
                break
            total += weight * utility(key, value)
        else:
            out[need] = total
    return out


def _pct(value: float) -> str:
    return f"{value * 100:.1f} %"


def _duration(seconds: float) -> str:
    if seconds == 0:
        return "none"
    if seconds >= 2 * DAY_S:
        return f"{seconds / DAY_S:.1f} d"
    return f"{seconds / 3600:.1f} h"


def _points(score: float) -> str:
    return f"{score * 100:.1f}"


def _list(names: Sequence[str]) -> str:
    if len(names) <= 1:
        return "".join(names)
    return ", ".join(names[:-1]) + " and " + names[-1]


def _limit_failures(row: CompareRow, mission: Mission) -> tuple[list[str], list[str], float]:
    """(reasons the site is excluded, caveats on checks that passed on a lower bound, how far
    over the limits it is: the summed overshoot relative to each limit, for "closest")."""
    reasons: list[str] = []
    caveats: list[str] = []
    miss = 0.0
    for limit in LIMITS:
        bound = getattr(mission.limits, limit.field)
        if bound is None:
            continue
        for key in limit.keys:
            value = _value(row, key)
            if value is None:
                reasons.append(f"{NAMES[key]} has no value, so the limit cannot be checked")
                miss += _UNCHECKED
                continue
            shown = value / limit.per_unit
            text = f"{shown:.1f}{limit.unit}"
            censored = _censored(row, key)
            if limit.kind == "max" and shown > bound:
                miss += (shown - bound) / bound
                reasons.append(
                    f"{NAMES[key]} {'≥ ' if censored else ''}{text} is over the "
                    f"{bound:g}{limit.unit} limit"
                )
            elif limit.kind == "min" and shown < bound:
                miss += (bound - shown) / bound
                tail = (
                    " (the run touches the window edge, so a longer window may show more)"
                    if censored
                    else ""
                )
                reasons.append(
                    f"{NAMES[key]} {text} is under the {bound:g}{limit.unit} required{tail}"
                )
            elif limit.kind == "max" and censored:
                caveats.append(
                    f"{row.name}: {NAMES[key]} ({text}) touches the window edge and is a lower "
                    f"bound, so it meets the {bound:g}{limit.unit} limit only within this window."
                )
    return reasons, caveats, miss


@dataclass
class _Ranked:
    entries: list[RankedSite]  # in ranking order: scored, then unscored, then excluded
    scored: list[RankedSite]
    caveats: list[str]
    miss: dict[str, float]  # excluded site id -> relative overshoot of its limits


def _rank(rows: Sequence[CompareRow], mission: Mission) -> _Ranked:
    shares = need_shares(mission)
    weighted = [need for need in NEEDS if shares[need] > 0]
    scored: list[RankedSite] = []
    unscored: list[RankedSite] = []
    excluded: list[RankedSite] = []
    caveats: list[str] = []
    misses: dict[str, float] = {}
    for row in rows:
        by_need = need_scores(row)
        failures, row_caveats, miss = _limit_failures(row, mission)
        base = {"site_id": row.site_id, "name": row.name, "need_scores": by_need}
        if failures:
            excluded.append(RankedSite(**base, status="excluded", reasons=failures))
            misses[row.site_id] = miss
            continue
        caveats += row_caveats
        if not weighted:
            unscored.append(
                RankedSite(**base, status="unscored", reasons=["no need is given any weight"])
            )
            continue
        missing = [
            NAMES[key]
            for need in weighted
            for key in NEED_COLUMNS[need]
            if _value(row, key) is None
        ]
        if missing:
            unscored.append(
                RankedSite(**base, status="unscored", reasons=[f"no value for {_list(missing)}"])
            )
            continue
        total = sum(shares[need] * by_need[need] for need in weighted)
        scored.append(RankedSite(**base, status="ranked", score=round(total, 12)))
    scored.sort(key=lambda e: (-(e.score or 0.0), e.name))
    ranks: list[int] = []
    for index, entry in enumerate(scored):
        previous = scored[index - 1] if index else None
        tied = previous is not None and abs((previous.score or 0) - (entry.score or 0)) <= _TIE
        ranks.append(ranks[-1] if tied else index + 1)
    # The schemas are frozen, so rank and the "recommended" status are set by copying.
    scored = [
        entry.model_copy(
            update={"rank": rank, "status": "recommended" if index == 0 else entry.status}
        )
        for index, (entry, rank) in enumerate(zip(scored, ranks, strict=True))
    ]
    excluded.sort(key=lambda e: (misses[e.site_id], e.name))  # nearest miss first
    return _Ranked(
        entries=[*scored, *unscored, *excluded], scored=scored, caveats=caveats, miss=misses
    )


def _leaders(ranked: _Ranked) -> set[str]:
    """Site ids sharing first place."""
    return {e.site_id for e in ranked.scored if e.rank == 1}


def _facts(row: CompareRow, need: Need) -> str:
    def v(key: str) -> float:
        value = _value(row, key)
        if value is None:  # only called for scored needs, which have every value
            raise ValueError(f"{key} has no value")
        return value

    if need == "power":
        return (
            f"sunlit {_pct(v('sun_illuminated_fraction'))} of the time, mean visible disc "
            f"{_pct(v('sun_mean_visible_disk_fraction'))}, longest darkness "
            f"{_duration(v('sun_longest_hidden_s'))}"
        )
    if need == "comms":
        return (
            f"Earth in view {_pct(v('earth_visible_fraction'))} of the time, longest outage "
            f"{_duration(v('earth_longest_outage_s'))}"
        )
    return (
        f"slope {v('slope_at_site_deg'):.1f}° at the site and {v('slope_p95_deg'):.1f}° at the "
        f"footprint's 95th percentile, roughness {v('roughness_rms_m'):.2f} m"
    )


def _explain(
    pick: RankedSite, row: CompareRow, ranked: _Ranked, mission: Mission
) -> tuple[list[str], list[str]]:
    """(reasons for the pick, what it gives up), one line per weighted need."""
    shares = need_shares(mission)
    reasons: list[str] = []
    tradeoffs: list[str] = []
    for need in sorted((n for n in NEEDS if shares[n] > 0), key=lambda n: -shares[n]):
        mine = pick.need_scores[need]
        best = max(ranked.scored, key=lambda e: e.need_scores[need])
        head = (
            f"{NEED_LABEL[need]} ({PRIORITY_LABEL[getattr(mission, need)]}, "
            f"{shares[need] * 100:.0f} % of the score): {_points(mine)}/100"
        )
        facts = _facts(row, need)
        if len(ranked.scored) == 1:
            reasons.append(f"{head}; {facts}.")
        elif best.need_scores[need] - mine <= _TIE:
            reasons.append(f"{head}, the best of the {len(ranked.scored)} ranked sites; {facts}.")
        else:
            tradeoffs.append(
                f"{head}, behind {best.name} ({_points(best.need_scores[need])}/100); {facts}."
            )
    if not reasons:
        reasons.append(
            "Not the best on any single need, but the best balance across them for these "
            "priorities."
        )
    return reasons, tradeoffs


def _robustness(
    rows: Sequence[CompareRow], mission: Mission, current: set[str]
) -> Robustness | None:
    names = {r.site_id: r.name for r in rows}
    tested = held = 0
    flips: list[RobustnessFlip] = []
    for need in NEEDS:
        index = PRIORITIES.index(getattr(mission, need))
        for step in (-1, 1):
            if not 0 <= index + step < len(PRIORITIES):
                continue
            variant = mission.model_copy(update={need: PRIORITIES[index + step]})
            if not any(need_shares(variant).values()):
                continue
            leaders = _leaders(_rank(rows, variant))
            if not leaders:
                continue
            tested += 1
            if leaders & current:
                held += 1
            else:
                first = min(leaders, key=lambda sid: names[sid])
                flips.append(
                    RobustnessFlip(
                        change=(
                            f"{NEED_LABEL[need]} set to {PRIORITY_LABEL[PRIORITIES[index + step]]}"
                        ),
                        site_id=first,
                        name=names[first],
                    )
                )
    if tested == 0:
        return None
    if not flips:
        statement = (
            f"Stable: the pick stays the same under all {tested} one-step changes to the "
            "priorities."
        )
    else:
        changes = "; ".join(f"{f.change} favours {f.name}" for f in flips)
        statement = (
            f"The pick holds under {held} of {tested} one-step changes to the priorities. "
            f"It changes when: {changes}."
        )
    return Robustness(tested=tested, held=held, flips=flips, statement=statement)


def _confidence(margin: float) -> Confidence:
    if margin <= _TIE:
        return "tie"
    if margin >= CLEAR_MARGIN:
        return "clear"
    return "moderate" if margin >= MODERATE_MARGIN else "narrow"


_LEAD: dict[str, str] = {
    "clear": "a clear lead",
    "moderate": "a moderate lead",
    "narrow": "a narrow lead, so treat the two as close",
}


def _no_pick_headline(ranked: _Ranked, mission: Mission, total: int) -> str:
    excluded = [e for e in ranked.entries if e.status == "excluded"]
    if not any(need_shares(mission).values()):
        return (
            "Every need is set to 'not needed', so there is nothing to rank on. Raise at least "
            "one priority."
        )
    if excluded and len(excluded) == total:
        closest = excluded[0]  # sorted by how far over the limits each site is
        if total == 1:
            return f"{closest.name} does not meet the mission limits: {_list(closest.reasons)}."
        return (
            f"No compared site meets the mission limits. Closest is {closest.name}: "
            f"{_list(closest.reasons)}."
        )
    return (
        "No compared site can be scored for this mission: the measures it weights have no "
        "value for the sites that meet the limits."
    )


def _evidence(mission: Mission, columns: dict[str, CompareColumn]) -> EvidenceSchema:
    shares = need_shares(mission)
    weights = column_weights(mission)
    limits = [
        f"limit {limit.field} = {getattr(mission.limits, limit.field):g} "
        f"(checked on {_list([NAMES[k] for k in limit.keys])})"
        for limit in LIMITS
        if getattr(mission.limits, limit.field) is not None
    ]
    return EvidenceSchema(
        kind="assumption",
        statement=(
            "Mission-fit score. The priorities and limits are the mission answers given; the "
            "priority weights, the weights inside each need and the reference scales are "
            "chosen by LUNARIS and are not mission requirements."
        ),
        method=METHOD,
        assumptions=[
            *(
                (
                    f"{NEED_LABEL[need]}: {PRIORITY_LABEL[getattr(mission, need)]}, "
                    f"{shares[need] * 100:.1f} % of the score"
                )
                for need in NEEDS
            ),
            *(
                (
                    f"weight {columns[key].label if key in columns else key} = {weight:.3f}; "
                    f"scale: {SCALES[key].rationale}"
                )
                for key, weight in weights.items()
            ),
            *limits,
        ],
        limitations=[
            (
                "Scores rank the compared sites for the analysed window only; another window "
                "can rank them differently."
            ),
            "Site coordinates are DEM tile centres, not landing points.",
            (
                "The roughness scale assumes the default footprint; roughness depends on its "
                "baseline."
            ),
            "Thermal, dust, resource and trajectory constraints are not part of the score.",
        ],
    )


def recommend(
    rows: Sequence[CompareRow], columns: Sequence[CompareColumn], mission: Mission
) -> Recommendation:
    """Rank the rows for the mission and name the best fit, with reasons and confidence."""
    by_key = {c.key: c for c in columns}
    by_id = {r.site_id: r for r in rows}
    shares = need_shares(mission)
    weights = column_weights(mission)
    ranked = _rank(rows, mission)
    common = {
        "mission": mission,
        "needs": [
            NeedInfo(
                need=need,
                label=NEED_LABEL[need],
                priority=getattr(mission, need),
                weight=shares[need],
            )
            for need in NEEDS
        ],
        "scales": [
            ScaleInfo(
                key=key,
                label=by_key[key].label if key in by_key else key,
                need=need,
                weight=weights[key],
                worst=SCALES[key].worst,
                best=SCALES[key].best,
                unit=by_key[key].unit if key in by_key else "",
                rationale=SCALES[key].rationale,
            )
            for need in NEEDS
            for key in NEED_COLUMNS[need]
        ],
        "ranking": ranked.entries,
        "method": METHOD,
        "evidence": _evidence(mission, by_key),
    }
    excluded = [e for e in ranked.entries if e.status == "excluded"]
    if not ranked.scored:
        return Recommendation(
            site_id=None,
            name=None,
            confidence="none",
            headline=_no_pick_headline(ranked, mission, len(rows)),
            reasons=[],
            tradeoffs=[],
            caveats=ranked.caveats,
            **common,
        )

    pick = ranked.scored[0]
    reasons, tradeoffs = _explain(pick, by_id[pick.site_id], ranked, mission)
    if pick.score is None:  # a ranked site always has a score
        raise ValueError("the recommended site has no score")
    score = _points(pick.score)
    if len(ranked.scored) == 1:
        if len(rows) == 1:
            headline = (
                f"Only one site is selected: {pick.name} scores {score}/100 for this mission. "
                "Add sites to get a recommendation between them."
            )
        elif excluded:
            headline = (
                f"{pick.name} is the only compared site that meets the mission limits "
                f"({score}/100)."
            )
        else:
            headline = f"{pick.name} is the only compared site that can be scored ({score}/100)."
        return Recommendation(
            site_id=pick.site_id,
            name=pick.name,
            confidence="only_option",
            headline=headline,
            reasons=reasons,
            tradeoffs=tradeoffs,
            caveats=ranked.caveats,
            **common,
        )

    runner = ranked.scored[1]
    if runner.score is None:
        raise ValueError("the runner-up has no score")
    margin = pick.score - runner.score
    confidence = _confidence(margin)
    if confidence == "tie":
        tied = [e.name for e in ranked.scored if e.rank == 1]
        headline = (
            f"{_list(tied)} score the same for this mission ({score}/100): these measures "
            "cannot separate them."
        )
    else:
        headline = (
            f"{pick.name} is the best fit for this mission: {score}/100 against "
            f"{_points(runner.score)}/100 for {runner.name} ({_LEAD[confidence]})."
        )
    return Recommendation(
        site_id=pick.site_id,
        name=pick.name,
        runner_up_site_id=runner.site_id,
        margin=round(margin, 12),
        confidence=confidence,
        headline=headline,
        reasons=reasons,
        tradeoffs=tradeoffs,
        caveats=ranked.caveats,
        robustness=_robustness(rows, mission, _leaders(ranked)),
        **common,
    )


__all__ = [
    "CENSORED_NOTE",
    "LIMITS",
    "NEED_COLUMNS",
    "NEED_LABEL",
    "PRIORITY_WEIGHT",
    "SCALES",
    "column_weights",
    "need_scores",
    "need_shares",
    "recommend",
    "utility",
]
