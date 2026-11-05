"""Wire format of illumination results and the timeline analysis (contract C4, T-24)."""

from __future__ import annotations

from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from lunaris_api.schemas.common import EvidenceSchema, Schema
from lunaris_api.schemas.ephemeris import MAX_STEP_S, MIN_STEP_S, EphemerisObserver
from lunaris_api.schemas.visibility import EarthVisibilityResult, HorizonLiteral, VisibilityWindow


class TimelineRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    site_id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9-]+$")
    start_utc: AwareDatetime = Field(description="Window start, ISO 8601 UTC.")
    end_utc: AwareDatetime = Field(description="Window end (inclusive when on a step), UTC.")
    step_s: float = Field(ge=MIN_STEP_S, le=MAX_STEP_S, description="Sample spacing, seconds.")


class SolarGeometrySample(Schema):
    epoch_utc: AwareDatetime
    azimuth_deg: float
    elevation_deg: float = Field(description="Of the Sun's centre, above the C0 plane.")
    solar_radius_deg: float = Field(description="Apparent angular radius of the Sun.")
    astronomical_visible_fraction: float = Field(
        description="Fraction of the solar disk above the astronomical horizon, [0, 1]."
    )
    terrain_horizon_elevation_deg: float | None = Field(
        description="Terrain horizon at the Sun's azimuth; null without a horizon mask."
    )
    terrain_visible_fraction: float | None = Field(
        description="Fraction of the solar disk above the terrain horizon; null without a mask."
    )
    terrain_truncated: bool | None = Field(
        description="True when the terrain fraction is an upper bound (truncated mask rays)."
    )


class IlluminationSummary(Schema):
    horizon: HorizonLiteral
    mean_visible_disk_fraction: float = Field(
        description="Time average of the visible solar-disk fraction: the quantity comparable "
        "to published average polar illumination (docs/SCIENCE.md §5.3)."
    )
    illuminated_fraction: float = Field(
        description="Share of samples with any part of the solar disk visible (≥ the mean)."
    )
    fully_lit_fraction: float = Field(description="Share of samples with the whole disk visible.")
    longest_illumination_s: float
    longest_illumination_censored: bool = Field(
        description="The longest run touches the window edge: its duration is a lower bound."
    )
    longest_darkness_s: float
    longest_darkness_censored: bool
    resolution_s: float = Field(description="Sample step: window edges are known to ± this.")
    any_truncated: bool
    sunlit_windows: list[VisibilityWindow]


class IlluminationResult(Schema):
    body: Literal["sun"]
    samples: list[SolarGeometrySample]
    astronomical: IlluminationSummary
    terrain: IlluminationSummary | None = Field(
        description="Null when no horizon mask is available for the site."
    )
    evidence: EvidenceSchema
    limitations: list[str]


class SoftwareComponent(Schema):
    name: str
    version: str | None


class SoftwareProvenance(Schema):
    service_version: str
    components: list[SoftwareComponent]


class TimelineAnalysis(Schema):
    """Illumination and Earth-visibility timelines for one site over a UTC window (C4)."""

    site_id: str
    site_name: str
    observer: EphemerisObserver
    start_utc: AwareDatetime
    end_utc: AwareDatetime
    step_s: float
    sample_count: int
    max_samples: int
    terrain_horizon_available: bool
    illumination: IlluminationResult
    earth_visibility: EarthVisibilityResult
    computed_at_utc: AwareDatetime
    software: SoftwareProvenance


__all__ = [
    "IlluminationResult",
    "IlluminationSummary",
    "SoftwareProvenance",
    "SolarGeometrySample",
    "TimelineAnalysis",
    "TimelineRequest",
]
