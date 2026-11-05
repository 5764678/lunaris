"""Wire schema for a site's terrain horizon mask (contract C1 on the wire, T-16)."""

from __future__ import annotations

from pydantic import Field

from lunaris_api.schemas.common import EvidenceSchema, Schema


class HorizonDemSchema(Schema):
    dataset_id: str
    title: str
    sha256: str = Field(description="SHA-256 of the DEM file the mask was computed from.")
    resolution_m: float
    source_url: str
    citation: str


class HorizonMaskResponse(Schema):
    site_id: str
    latitude_deg: float
    longitude_deg: float
    frame: str = "MOON_ME"
    observer_height_m: float = Field(description="Eye height above the DEM surface, m.")
    surface_height_m: float = Field(
        description="DEM height at the site above the 1 737 400 m sphere."
    )
    azimuth_step_deg: float
    azimuth_deg: list[float] = Field(description="Uniform, from 0, clockwise from local north.")
    elevation_deg: list[float] = Field(
        description="Horizon elevation above the site's radial horizontal plane (C0)."
    )
    truncated: list[bool] = Field(
        description="True where the ray left DEM coverage before max_range_m: the elevation "
        "there is only a lower bound."
    )
    truncated_count: int
    max_range_m: float
    method: str
    dem: HorizonDemSchema
    evidence: EvidenceSchema
    limitations: list[str]
