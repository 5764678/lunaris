"""Wire format of Earth-visibility results (contract C4, T-24).

Geometric line of sight only: Earth visibility does not imply a radio link.
"""

from __future__ import annotations

from typing import Literal

from pydantic import AwareDatetime, Field

from lunaris_api.schemas.common import EvidenceSchema, Schema

HorizonLiteral = Literal["astronomical", "terrain"]
LineOfSightLiteral = Literal["clear", "terrain_obstructed", "below_geometric_horizon"]


class VisibilityWindow(Schema):
    """A maximal run of samples meeting a condition. Each sample stands for one step, so
    the edges are known to within ``resolution_s``."""

    start_utc: AwareDatetime
    end_utc: AwareDatetime = Field(description="Epoch of the last sample in the run + step.")
    duration_s: float
    censored_start: bool = Field(description="Run touches the start of the analysis window.")
    censored_end: bool = Field(description="Run touches the end of the analysis window.")


class EarthGeometrySample(Schema):
    epoch_utc: AwareDatetime
    azimuth_deg: float
    elevation_deg: float = Field(description="Of the Earth's centre, above the C0 plane.")
    earth_radius_deg: float = Field(description="Apparent angular radius of the Earth.")
    astronomical_visible_fraction: float = Field(
        description="Fraction of the Earth's disk above the astronomical horizon, [0, 1]."
    )
    terrain_horizon_elevation_deg: float | None = Field(
        description="Terrain horizon at the Earth's azimuth; null without a horizon mask."
    )
    terrain_visible_fraction: float | None = Field(
        description="Fraction of the disk above the terrain horizon; null without a mask."
    )
    terrain_truncated: bool | None = Field(
        description="True when the terrain fraction is an upper bound (truncated mask rays)."
    )
    line_of_sight: LineOfSightLiteral


class EarthVisibilitySummary(Schema):
    horizon: HorizonLiteral
    visible_fraction: float = Field(
        description="Share of samples with any part of the Earth's disk visible."
    )
    mean_visible_disk_fraction: float = Field(description="Time average of the disk fraction.")
    fully_visible_fraction: float = Field(
        description="Share of samples with the whole disk visible."
    )
    longest_visibility_s: float
    longest_visibility_censored: bool = Field(
        description="The longest run touches the window edge: its duration is a lower bound."
    )
    longest_outage_s: float
    longest_outage_censored: bool
    resolution_s: float = Field(description="Sample step: window edges are known to ± this.")
    any_truncated: bool
    windows: list[VisibilityWindow] = Field(
        description="Direct-to-Earth geometric visibility windows (any part of the disk visible)."
    )


class EarthVisibilityResult(Schema):
    body: Literal["earth"]
    samples: list[EarthGeometrySample]
    astronomical: EarthVisibilitySummary
    terrain: EarthVisibilitySummary | None = Field(
        description="Null when no horizon mask is available for the site."
    )
    evidence: EvidenceSchema
    limitations: list[str] = Field(
        description="Always includes the statement that geometric visibility does not imply a "
        "radio link."
    )


__all__ = [
    "EarthGeometrySample",
    "EarthVisibilityResult",
    "EarthVisibilitySummary",
    "HorizonLiteral",
    "VisibilityWindow",
]
