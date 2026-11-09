"""Wire format of the site ephemeris endpoint (contract C2 in ``docs/TASKS.md``)."""

from __future__ import annotations

from typing import Literal

from pydantic import AwareDatetime, Field

from lunaris_api.schemas.common import EvidenceSchema, Schema

MAX_EPHEMERIS_SAMPLES = 10_000
"""Cap on epochs per request (per body). One year at a 1 h step is 8 760 samples."""

MIN_STEP_S = 1.0
MAX_STEP_S = 30 * 86_400.0


class EphemerisSample(Schema):
    """Apparent geometry of one body at one epoch, seen from the site."""

    epoch_utc: AwareDatetime
    azimuth_deg: float = Field(description="Clockwise from local north, [0, 360) (C0).")
    elevation_deg: float = Field(
        description="Above the local horizontal plane of the reference sphere (C0); "
        "astronomical horizon, not terrain."
    )
    range_m: float = Field(description="Observer–body distance (apparent, light-time corrected).")
    angular_radius_deg: float = Field(description="asin(R_body / range).")
    direction_moon_me: list[float] = Field(
        min_length=3,
        max_length=3,
        description="Apparent unit direction [x, y, z] in MOON_ME (lights the 3D scene, D5).",
    )


class BodyEphemeris(Schema):
    body: Literal["sun", "earth"]
    body_radius_m: float = Field(description="Radius used for angular_radius_deg.")
    body_radii_m: list[float] = Field(
        min_length=3, max_length=3, description="PCK radii (a, b, c) of the body."
    )
    samples: list[EphemerisSample]
    evidence: EvidenceSchema


class EphemerisObserver(Schema):
    latitude_deg: float
    longitude_deg: float
    frame: Literal["MOON_ME"]
    reference_radius_m: float
    surface_height_m: float | None = Field(
        description="DEM height above the reference sphere; null when not sampled (h = 0 used)."
    )
    observer_height_m: float
    radius_m: float = Field(description="Distance of the eye point from the Moon's centre.")


class SiteEphemeris(Schema):
    """Sun and Earth geometry time series for one site (C2)."""

    site_id: str
    site_name: str
    observer: EphemerisObserver
    start_utc: AwareDatetime
    end_utc: AwareDatetime
    step_s: float
    sample_count: int
    max_samples: int = Field(description="Cap on samples per request.")
    frame: Literal["MOON_ME"]
    aberration_correction: Literal["CN+S"]
    bodies: list[BodyEphemeris]
    limitations: list[str]


class SunDirectionSample(Schema):
    """Apparent Sun direction from the Moon's centre at one epoch (T-26)."""

    epoch_utc: AwareDatetime
    direction_moon_me: list[float] = Field(
        min_length=3,
        max_length=3,
        description="Apparent unit vector [x, y, z] from the Moon's centre to the Sun, MOON_ME.",
    )
    subsolar_latitude_deg: float = Field(
        description="Planetocentric latitude where the Sun is at the zenith (1737.4 km sphere)."
    )
    subsolar_longitude_deg: float = Field(description="East longitude, [0, 360).")
    angular_radius_deg: float = Field(description="asin(R_sun / range).")
    range_m: float = Field(description="Moon centre – Sun distance (apparent).")


class SunDirectionSeries(Schema):
    """Moon-centred Sun direction series for lighting the globe (T-26)."""

    start_utc: AwareDatetime
    end_utc: AwareDatetime
    step_s: float
    sample_count: int
    max_samples: int = Field(description="Cap on samples per request.")
    frame: Literal["MOON_ME"]
    origin: Literal["MOON"] = Field(description="Directions are from the Moon's centre.")
    aberration_correction: Literal["CN+S"]
    sun_radius_m: float = Field(description="Solar radius from the loaded PCK.")
    samples: list[SunDirectionSample]
    evidence: EvidenceSchema
    limitations: list[str]


__all__ = [
    "MAX_EPHEMERIS_SAMPLES",
    "MAX_STEP_S",
    "MIN_STEP_S",
    "BodyEphemeris",
    "EphemerisObserver",
    "EphemerisSample",
    "SiteEphemeris",
    "SunDirectionSample",
    "SunDirectionSeries",
]
