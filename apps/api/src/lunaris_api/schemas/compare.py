"""Wire schemas for the site comparison table (T-17).

Every cell carries its own evidence so the UI can show the source of any number. A cell
that cannot be computed has ``value: null`` and a ``reason``; it is never 0.
"""

from __future__ import annotations

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
