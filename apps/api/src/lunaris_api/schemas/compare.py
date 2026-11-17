"""Wire schemas for the site comparison table (T-17).

Every cell carries its own evidence so the UI can show the source of any number. A cell
that cannot be computed has ``value: null`` and a ``reason``; it is never 0.
"""

from __future__ import annotations

from typing import Literal

from pydantic import AwareDatetime, Field

from lunaris_api.schemas.common import EvidenceSchema, Schema

Need = Literal["power", "comms", "landing"]
Priority = Literal["none", "low", "medium", "high"]
SiteStatus = Literal["recommended", "ranked", "excluded", "unscored"]
Confidence = Literal["clear", "moderate", "narrow", "tie", "only_option", "none"]


class CompareCell(Schema):
    value: float | None = Field(description="null when not computed; see `reason`.")
    unit: str = Field(description="Unit of `value`: m, deg, s, fraction or count.")
    baseline_m: float | None = Field(
        default=None, description="Measurement baseline for slope and roughness, m."
    )
    reason: str | None = Field(default=None, description="Why the value is null.")
    evidence: EvidenceSchema | None = None
    limitations: list[str] = Field(default_factory=list)


class CompareRow(Schema):
    site_id: str
    name: str
    origin: str
    latitude_deg: float
    longitude_deg: float
    surface_height_m: CompareCell
    slope_at_site_deg: CompareCell
    slope_p95_deg: CompareCell
    roughness_rms_m: CompareCell
    horizon_min_deg: CompareCell
    horizon_max_deg: CompareCell
    horizon_truncated_azimuths: CompareCell
    sun_mean_visible_disk_fraction: CompareCell
    sun_illuminated_fraction: CompareCell
    sun_longest_hidden_s: CompareCell
    sun_longest_visible_s: CompareCell
    earth_visible_fraction: CompareCell
    earth_longest_outage_s: CompareCell


class CompareColumn(Schema):
    key: str
    label: str
    unit: str
    description: str
    better: Literal["higher", "lower"] | None = Field(
        default=None,
        description="Which direction is better for a mission, or null when there is no "
        "universal direction (the column is then not ranked).",
    )
    better_rationale: str = Field(default="", description="One line: why that direction.")


class ColumnLeaders(Schema):
    key: str
    better: Literal["higher", "lower"]
    site_ids: list[str] = Field(description="Best value among non-null cells; ties allowed.")
    value: float | None = Field(
        description="The leading value; null when fewer than 2 sites have one."
    )
    compared_sites: int = Field(description="Sites with a non-null value in this column.")


class SiteStanding(Schema):
    site_id: str
    name: str
    leads: list[str] = Field(description="Directed columns where this site is best or tied.")
    trails: list[str] = Field(
        description="Directed columns where this site is worst (not tied best)."
    )
    directed_compared: int = Field(
        description="Directed columns with this site's value and ≥ 2 values."
    )
    dominated_by: list[str] = Field(
        description="Site ids that are at least as good on every directed column both have "
        "values for, and strictly better on at least one (Pareto dominance)."
    )
    dominance: str


class MissionLimits(Schema):
    """Hard requirements. A site that breaks one is excluded, never down-weighted."""

    max_slope_deg: float | None = None
    max_darkness_d: float | None = None
    max_earth_outage_d: float | None = None
    min_sunlit_d: float | None = None


class Mission(Schema):
    """The answers to the mission questions: how much each need matters, and the limits."""

    power: Priority = "medium"
    comms: Priority = "medium"
    landing: Priority = "medium"
    limits: MissionLimits = MissionLimits()


class NeedInfo(Schema):
    need: Need
    label: str
    priority: Priority
    weight: float = Field(description="Share of the score, 0..1; the shares sum to 1.")


class ScaleInfo(Schema):
    """Fixed reference scale of one scored measure: ``worst`` scores 0, ``best`` scores 1."""

    key: str
    label: str
    need: Need
    weight: float = Field(description="Share of the score, 0..1.")
    worst: float
    best: float
    unit: str
    rationale: str


class RankedSite(Schema):
    site_id: str
    name: str
    status: SiteStatus
    rank: int | None = None
    score: float | None = None
    need_scores: dict[str, float] = Field(
        default_factory=dict, description="0..1 per need, where every measure has a value."
    )
    reasons: list[str] = Field(
        default_factory=list, description="Why the site is excluded or has no score."
    )


class RobustnessFlip(Schema):
    change: str
    site_id: str
    name: str


class Robustness(Schema):
    tested: int
    held: int
    flips: list[RobustnessFlip]
    statement: str


class Recommendation(Schema):
    mission: Mission
    site_id: str | None
    name: str | None
    runner_up_site_id: str | None = None
    margin: float | None = None
    confidence: Confidence
    headline: str
    reasons: list[str]
    tradeoffs: list[str]
    caveats: list[str]
    robustness: Robustness | None = None
    needs: list[NeedInfo]
    scales: list[ScaleInfo]
    ranking: list[RankedSite]
    method: str
    evidence: EvidenceSchema


class ComparisonSummary(Schema):
    leaders: list[ColumnLeaders]
    sites: list[SiteStanding]
    verdict: str = Field(description="Generated from dominance only; never from weights.")
    method: str
    recommendation: Recommendation = Field(
        description="The best-fitting site for the stated mission (priorities and limits); "
        "every weight and scale is returned as assumption evidence."
    )


class SiteComparison(Schema):
    start_utc: AwareDatetime
    end_utc: AwareDatetime
    step_s: float
    sample_count: int
    observer_height_m: float
    footprint_radius_m: float
    columns: list[CompareColumn]
    rows: list[CompareRow]
    assumptions: list[str]
    summary: ComparisonSummary
