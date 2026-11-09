"""Comparison summary (T-18): leaders, dominance and a verdict without hidden weights.

* Each column declares ``better`` (``higher`` / ``lower`` / ``None``) with a one-line
  rationale; only directed columns are ranked.
* A column's leaders are the sites with the best non-null value; ties (equal values within a
  relative 1e-9) all lead. A column needs at least two non-null values to rank anything.
  Null cells never win and never lose.
* A site *leads* where it is best or tied, and *trails* where it is worst without also being
  best (all-equal columns rank nobody worst).
* Pareto dominance: site A dominates B when, on every directed column where both have a
  value, A is at least as good, and A is strictly better on at least one.
* The verdict sentence is built only from these relations, never from weights.
* An optional profile gives fixed, documented weights over directed columns, applied to
  values min-max normalised within the compared sites. Weights and normalisation are
  returned as ``assumption`` evidence. Without a profile there is no score at all.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Literal

from lunaris_api.schemas.common import EvidenceSchema
from lunaris_api.schemas.compare import (
    ColumnLeaders,
    CompareColumn,
    CompareRow,
    ComparisonSummary,
    ProfileScore,
    ScoreEntry,
    SiteStanding,
)

Better = Literal["higher", "lower"]
Profile = Literal["power", "comms", "landing"]

DIRECTIONS: dict[str, tuple[Better | None, str]] = {
    "surface_height_m": (
        None,
        "No universal direction: height matters only relative to the terrain around it.",
    ),
    "slope_at_site_deg": ("lower", "Gentler slopes are safer for landing and surface operations."),
    "slope_p95_deg": ("lower", "Fewer steep cells in the footprint means a safer landing area."),
    "roughness_rms_m": ("lower", "Smoother terrain is safer for landing and mobility."),
    "horizon_min_deg": (
        None,
        "No universal direction: a low horizon helps sunlight but not shelter.",
    ),
    "horizon_max_deg": (
        None,
        "No universal direction: high terrain blocks the Sun and Earth but can also shelter.",
    ),
    "horizon_truncated_azimuths": (
        None,
        "Data completeness of the horizon mask, not a property of the site.",
    ),
    "sun_mean_visible_disk_fraction": (
        "higher",
        "More of the solar disk on average means more power.",
    ),
    "sun_illuminated_fraction": ("higher", "More sunlit time means more power."),
    "sun_longest_hidden_s": ("lower", "Shorter darkness is easier to survive on batteries."),
    "earth_visible_fraction": (
        "higher",
        "More time with Earth in view means more direct-to-Earth comms.",
    ),
    "earth_longest_outage_s": (
        "lower",
        "Shorter outages mean shorter gaps in direct-to-Earth comms.",
    ),
}

SHORT: dict[str, str] = {
    "slope_at_site_deg": "slope at the site",
    "slope_p95_deg": "footprint slope",
    "roughness_rms_m": "roughness",
    "sun_mean_visible_disk_fraction": "mean sunlight",
    "sun_illuminated_fraction": "sunlit time",
    "sun_longest_hidden_s": "longest darkness",
    "earth_visible_fraction": "Earth visibility",
    "earth_longest_outage_s": "longest Earth outage",
}

PROFILES: dict[Profile, dict[str, float]] = {
    "power": {
        "sun_mean_visible_disk_fraction": 0.4,
        "sun_illuminated_fraction": 0.2,
        "sun_longest_hidden_s": 0.4,
    },
    "comms": {"earth_visible_fraction": 0.6, "earth_longest_outage_s": 0.4},
    "landing": {"slope_at_site_deg": 0.3, "slope_p95_deg": 0.4, "roughness_rms_m": 0.3},
}

NORMALISATION = (
    "Min-max within the compared sites, per column: (v − min) / (max − min) when higher is "
    "better, (max − v) / (max − min) when lower is better; 1 for every site when all values "
    "are equal. Score = Σ weight × normalised value. A site with a null cell in a weighted "
    "column has no score."
)
SUMMARY_METHOD = (
    "Directions are declared per column. Leaders: best non-null value, ties within a "
    "relative 1e-9. Pareto dominance over directed columns where both sites have values. "
    "The verdict is generated from leads, trails and dominance only, never from weights."
)
_REL_TOL = 1e-9


def directed_columns(columns: Sequence[CompareColumn]) -> list[CompareColumn]:
    return [c for c in columns if c.better is not None]


def with_directions(columns: Sequence[CompareColumn]) -> list[CompareColumn]:
    out = []
    for c in columns:
        better, why = DIRECTIONS.get(c.key, (None, "No declared direction."))
        out.append(c.model_copy(update={"better": better, "better_rationale": why}))
    return out


def _value(row: CompareRow, key: str) -> float | None:
    value: float | None = getattr(row, key).value
    return value


def _equal(a: float, b: float) -> bool:
    return abs(a - b) <= _REL_TOL * max(1.0, abs(a), abs(b))


def _goodness(value: float, better: Better) -> float:
    """Larger is better, whatever the column's direction."""
    return value if better == "higher" else -value


def _leaders(rows: Sequence[CompareRow], column: CompareColumn) -> ColumnLeaders:
    assert column.better is not None  # noqa: S101 - directed columns only
    values = [(r.site_id, _value(r, column.key)) for r in rows]
    present = [(sid, v) for sid, v in values if v is not None]
    if len(present) < 2:  # noqa: PLR2004
        return ColumnLeaders(
            key=column.key,
            better=column.better,
            site_ids=[],
            value=None,
            compared_sites=len(present),
        )
    best = max(_goodness(v, column.better) for _, v in present)
    winners = [(sid, v) for sid, v in present if _equal(_goodness(v, column.better), best)]
    return ColumnLeaders(
        key=column.key,
        better=column.better,
        site_ids=[sid for sid, _ in winners],
        value=winners[0][1],
        compared_sites=len(present),
    )


def _losers(rows: Sequence[CompareRow], column: CompareColumn, leaders: ColumnLeaders) -> set[str]:
    assert column.better is not None  # noqa: S101
    present = [
        (r.site_id, _value(r, column.key)) for r in rows if _value(r, column.key) is not None
    ]
    if len(present) < 2:  # noqa: PLR2004
        return set()
    worst = min(_goodness(v, column.better) for _, v in present if v is not None)
    return {
        sid
        for sid, v in present
        if v is not None
        and _equal(_goodness(v, column.better), worst)
        and sid not in leaders.site_ids
    }


def _dominates(a: CompareRow, b: CompareRow, columns: Sequence[CompareColumn]) -> bool:
    strictly = False
    shared = 0
    for c in columns:
        va, vb = _value(a, c.key), _value(b, c.key)
        if va is None or vb is None or c.better is None:
            continue
        shared += 1
        ga, gb = _goodness(va, c.better), _goodness(vb, c.better)
        if _equal(ga, gb):
            continue
        if ga < gb:
            return False
        strictly = True
    return shared > 0 and strictly


GROUPS: list[tuple[tuple[str, ...], str]] = [
    (("slope_at_site_deg", "slope_p95_deg"), "slope"),
    (
        ("sun_mean_visible_disk_fraction", "sun_illuminated_fraction", "sun_longest_hidden_s"),
        "sunlight and darkness",
    ),
    (("earth_visible_fraction", "earth_longest_outage_s"), "Earth visibility"),
]


def _phrase(keys: Sequence[str]) -> str:
    """Readable list; a complete group of related columns collapses to one phrase."""
    remaining = list(keys)
    names: list[str] = []
    for members, label in GROUPS:
        if all(m in remaining for m in members):
            names.append(label)
            remaining = [k for k in remaining if k not in members]
    names += [SHORT.get(k, k) for k in remaining]
    return _list(names)


def _verdict(rows: Sequence[CompareRow], standings: dict[str, SiteStanding], ranked: int) -> str:
    names = {r.site_id: r.name for r in rows}
    if len(rows) < 2:  # noqa: PLR2004
        return "Only one site: nothing to compare."
    if ranked == 0:
        return "No directed metric has values for two or more sites, so no site can be ranked."
    front = [r.site_id for r in rows if not standings[r.site_id].dominated_by]
    if len(front) == 1:
        sid = front[0]
        s = standings[sid]
        others = [names[o] for o in names if o != sid]
        if not s.trails and len(s.leads) == s.directed_compared:
            return (
                f"{names[sid]} is best or tied on every directed metric compared "
                f"({s.directed_compared}) and dominates {_list(others)}."
            )
        tradeoff = f"; trade-off: worst on {_phrase(s.trails)}" if s.trails else ""
        return f"{names[sid]} dominates {_list(others)}: it leads on {_phrase(s.leads)}{tradeoff}."
    front.sort(key=lambda sid: -len(standings[sid].leads))
    parts = []
    for sid in front:
        st = standings[sid]
        if st.leads:
            text = f"{names[sid]} leads on {_phrase(st.leads)}"
            text += f"; trade-off: worst on {_phrase(st.trails)}" if st.trails else ""
        else:
            text = f"{names[sid]} leads on no metric but is not dominated"
            text += f"; worst on {_phrase(st.trails)}" if st.trails else ""
        parts.append(text + ".")
    dominated = [names[r.site_id] for r in rows if standings[r.site_id].dominated_by]
    tail = (
        [f"{_list(dominated)} {'is' if len(dominated) == 1 else 'are'} dominated."]
        if dominated
        else []
    )
    return " ".join(["No single site is best on every directed metric.", *parts, *tail])


def _list(names: Sequence[str]) -> str:
    if len(names) <= 1:
        return "".join(names)
    return ", ".join(names[:-1]) + " and " + names[-1]


def _score(
    rows: Sequence[CompareRow], columns: Sequence[CompareColumn], profile: Profile
) -> ProfileScore:
    weights = PROFILES[profile]
    by_key = {c.key: c for c in columns}
    normalised: dict[str, dict[str, float]] = {}
    for key in weights:
        better = by_key[key].better
        assert better is not None  # noqa: S101
        present = {r.site_id: v for r in rows if (v := _value(r, key)) is not None}
        if not present:
            continue
        lo, hi = min(present.values()), max(present.values())
        span = hi - lo
        normalised[key] = {
            sid: 1.0
            if _equal(lo, hi)
            else ((v - lo) / span if better == "higher" else (hi - v) / span)
            for sid, v in present.items()
        }
    entries = []
    for r in rows:
        missing = [k for k in weights if r.site_id not in normalised.get(k, {})]
        if missing:
            entries.append(
                ScoreEntry(
                    site_id=r.site_id,
                    name=r.name,
                    score=None,
                    reason=f"no value for {_phrase(missing)}",
                )
            )
        else:
            total = sum(w * normalised[k][r.site_id] for k, w in weights.items())
            entries.append(ScoreEntry(site_id=r.site_id, name=r.name, score=round(total, 12)))
    entries.sort(key=lambda e: (e.score is None, -(e.score or 0.0)))
    return ProfileScore(
        profile=profile,
        weights=dict(weights),
        normalisation=NORMALISATION,
        scores=entries,
        evidence=EvidenceSchema(
            kind="assumption",
            statement=(
                f"'{profile}' profile score: fixed weights chosen by LUNARIS for this profile, "
                "not a mission requirement. Scores rank only the compared sites."
            ),
            method=NORMALISATION,
            assumptions=[f"weight {k} = {w:g}" for k, w in weights.items()]
            + ["Normalisation is relative to the compared sites: adding a site can change scores."],
        ),
    )


def summarize(
    rows: Sequence[CompareRow],
    columns: Sequence[CompareColumn],
    *,
    profile: Profile | None = None,
) -> ComparisonSummary:
    """Leaders, per-site standing, Pareto dominance, verdict and optional profile score."""
    directed = directed_columns(columns)
    leaders = [_leaders(rows, c) for c in directed]
    losers = {c.key: _losers(rows, c, lead) for c, lead in zip(directed, leaders, strict=True)}
    ranked = [lead for lead in leaders if lead.site_ids]

    standings: dict[str, SiteStanding] = {}
    for r in rows:
        leads = [lead.key for lead in ranked if r.site_id in lead.site_ids]
        trails = [lead.key for lead in ranked if r.site_id in losers[lead.key]]
        compared = sum(1 for lead in ranked if _value(r, lead.key) is not None)
        dominated_by = [o.site_id for o in rows if o is not r and _dominates(o, r, directed)]
        names = {o.site_id: o.name for o in rows}
        text = f"Best or tied on {len(leads)} of {compared} directed metrics"
        text += f"; worst on {_phrase(trails)}" if trails else "; worst on none"
        if dominated_by:
            text += f"; dominated by {_list([names[d] for d in dominated_by])}"
        standings[r.site_id] = SiteStanding(
            site_id=r.site_id,
            name=r.name,
            leads=leads,
            trails=trails,
            directed_compared=compared,
            dominated_by=dominated_by,
            dominance=text + ".",
        )

    return ComparisonSummary(
        leaders=leaders,
        sites=[standings[r.site_id] for r in rows],
        verdict=_verdict(rows, standings, len(ranked)),
        method=SUMMARY_METHOD,
        score=_score(rows, directed, profile) if profile is not None else None,
    )


__all__ = [
    "DIRECTIONS",
    "NORMALISATION",
    "PROFILES",
    "SUMMARY_METHOD",
    "Profile",
    "directed_columns",
    "summarize",
    "with_directions",
]
