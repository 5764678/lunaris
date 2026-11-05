"""Wire schemas for the cited candidate-site catalogue (T-03)."""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from lunaris_api.schemas.common import Schema
from lunaris_api.schemas.sites import CandidateSite


class CatalogSourceSchema(Schema):
    title: str
    url: str
    use: str


class CatalogReferencePointSchema(Schema):
    latitude_deg: float
    longitude_deg: float
    frame: Literal["MOON_ME"]


class CatalogTileSchema(Schema):
    url: str
    width_px: int
    height_px: int
    pixel_size_m: float
    extent_km: float
    centre_x_m: float
    centre_y_m: float


class CatalogSiteSchema(Schema):
    id: str
    name: str
    pgda_site_id: str
    artemis_iii_2022_region: str | None
    demo_trio: bool
    reference_point: CatalogReferencePointSchema
    tile: CatalogTileSchema
    register_url: str = Field(description="POST here to add this site to the registry.")


class SiteCatalogResponse(Schema):
    id: str
    title: str
    evidence_kind: Literal["derived_product"]
    reference_point_definition: str = Field(
        description="What the coordinates mean: the DEM tile centre, NOT a landing point."
    )
    method: str
    retrieved_on: str
    citation: str
    sources: list[CatalogSourceSchema]
    limitations: list[str]
    sites: list[CatalogSiteSchema]
    count: int
    demo_trio_register_url: str


class RegisteredCatalogSites(Schema):
    sites: list[CandidateSite]
    created: list[str] = Field(description="Catalogue ids registered by this request.")
    already_registered: list[str] = Field(
        description="Catalogue ids whose site (same name) was already in the registry."
    )
