"""Typed loader for the south-pole candidate-site catalogue (T-02 data, T-03 API).

The catalogue is version-controlled JSON derived from published sources; every entry is
validated here (coordinates in range, frame MOON_ME, unique ids, sources present).
"""

from __future__ import annotations

import json
from functools import lru_cache
from importlib import resources
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator

SITE_CATALOG_ID = "south-pole-candidate-sites"


class _Frozen(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class CatalogSource(_Frozen):
    title: str = Field(min_length=1)
    url: HttpUrl
    use: str


class ReferencePoint(_Frozen):
    latitude_deg: Annotated[float, Field(ge=-90, le=90)]
    longitude_deg: Annotated[float, Field(ge=0, lt=360)]
    frame: Literal["MOON_ME"]


class SiteTile(_Frozen):
    url: HttpUrl
    width_px: int
    height_px: int
    pixel_size_m: float
    extent_km: float
    centre_x_m: float
    centre_y_m: float


class CatalogSite(_Frozen):
    id: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{1,63}$")
    name: str = Field(min_length=1, max_length=80)
    pgda_site_id: str
    artemis_iii_2022_region: str | None = None
    demo_trio: bool = False
    reference_point: ReferencePoint
    tile: SiteTile


class SiteCatalog(_Frozen):
    schema_version: Literal[1]
    id: Literal["south-pole-candidate-sites"]
    title: str
    evidence_kind: Literal["derived_product"]
    reference_point_definition: str = Field(min_length=1)
    method: str
    retrieved_on: str
    sources: tuple[CatalogSource, ...] = Field(min_length=1)
    limitations: tuple[str, ...]
    sites: tuple[CatalogSite, ...] = Field(min_length=1)

    @model_validator(mode="after")
    def _unique(self) -> SiteCatalog:
        ids = [s.id for s in self.sites]
        if len(ids) != len(set(ids)):
            raise ValueError("catalogue site ids must be unique")
        return self

    def site(self, site_id: str) -> CatalogSite:
        for entry in self.sites:
            if entry.id == site_id:
                return entry
        raise KeyError(site_id)

    @property
    def citation(self) -> str:
        """Short citation for a registered catalogue site (PGDA product 78 DEMs)."""
        return (
            "PGDA product 78 (pgda.gsfc.nasa.gov/products/78); Barker et al. (2021), "
            "Planet. Space Sci. 203, 105119, doi:10.1016/j.pss.2020.105119"
        )


@lru_cache(maxsize=1)
def load_site_catalog() -> SiteCatalog:
    """Load and validate the packaged catalogue."""
    text = (
        resources.files("lunaris_data.catalogs")
        .joinpath(f"{SITE_CATALOG_ID}.json")
        .read_text(encoding="utf-8")
    )
    return SiteCatalog.model_validate(json.loads(text))


__all__ = [
    "SITE_CATALOG_ID",
    "CatalogSite",
    "CatalogSource",
    "ReferencePoint",
    "SiteCatalog",
    "SiteTile",
    "load_site_catalog",
]
