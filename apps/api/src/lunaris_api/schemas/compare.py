"""Wire schemas for the site comparison table (T-17).

Every cell carries its own evidence so the UI can show the source of any number. A cell
that cannot be computed has ``value: null`` and a ``reason``; it is never 0.
"""

from __future__ import annotations

from typing import Literal

from pydantic import AwareDatetime, Field

from lunaris_api.schemas.common import EvidenceSchema, Schema


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


class ScoreEntry(Schema):
    site_id: str
    name: str
    score: float | None = Field(description="Weighted sum of normalised values in [0, 1].")
    reason: str | None = None


class ProfileScore(Schema):
    profile: Literal["power", "comms", "landing"]
    weights: dict[str, float]
    normalisation: str
    scores: list[ScoreEntry] = Field(description="Sorted by score, best first; null scores last.")
    evidence: EvidenceSchema


class ComparisonSummary(Schema):
    leaders: list[ColumnLeaders]
    sites: list[SiteStanding]
    verdict: str = Field(description="Generated from dominance only; never from weights.")
    method: str
    score: ProfileScore | None = Field(
        default=None, description="Only when a `profile` is requested; there is no default score."
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
