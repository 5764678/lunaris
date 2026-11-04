"""Candidate landing site contracts.

In Milestone 01, candidate sites are **user-defined**: LUNARIS does not ship curated
site coordinates until each one can be cited to a published source. The ``origin``
field makes the distinction explicit on the wire.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints

from lunaris_api.schemas.common import EvidenceSchema, Schema

SiteName = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True, min_length=1, max_length=80, pattern=r"^[^\x00-\x1f\x7f]+$"
    ),
]
OptionalText300 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)]
OptionalText1000 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)]


class CandidateSiteCreate(BaseModel):
    """Request body for registering a user-defined candidate site."""

    model_config = ConfigDict(extra="forbid")

    name: SiteName
    latitude_deg: float = Field(
        ge=-90, le=90, allow_inf_nan=False, description="Planetocentric latitude, degrees."
    )
    longitude_deg: float = Field(
        ge=-180,
        le=360,
        allow_inf_nan=False,
        description="East longitude, degrees. Accepted in [-180, 360]; stored in [0, 360).",
    )
    reference: OptionalText300 | None = Field(
        default=None, description="Optional citation for where the coordinates come from."
    )
    notes: OptionalText1000 | None = None


class SelenographicCoordinateSchema(Schema):
    latitude_deg: float = Field(description="Planetocentric latitude, degrees, [-90, 90].")
    longitude_deg: float = Field(description="East longitude, degrees, [0, 360).")
    frame: Literal["MOON_ME"]


class BodyFixedPositionSchema(Schema):
    x_m: float
    y_m: float
    z_m: float
    frame: Literal["MOON_ME"]
    reference_radius_m: float
    evidence: EvidenceSchema


class CandidateSite(Schema):
    id: str
    name: str
    coordinate: SelenographicCoordinateSchema
    origin: Literal["user_defined"]
    reference: str | None = None
    notes: str | None = None
    created_at_utc: AwareDatetime
    body_fixed_position: BodyFixedPositionSchema


class CandidateSiteList(Schema):
    sites: list[CandidateSite]
    count: int
    limit: int = Field(description="Maximum number of sites the registry accepts.")


__all__ = [
    "BodyFixedPositionSchema",
    "CandidateSite",
    "CandidateSiteCreate",
    "CandidateSiteList",
    "SelenographicCoordinateSchema",
]
