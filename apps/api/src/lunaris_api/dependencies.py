"""FastAPI dependency providers. Application-scoped resources live on ``app.state``
(created in the lifespan); request-scoped resources (DB sessions) are yielded here."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from lunaris_api.db.repositories import SqlAlchemySiteRepository
from lunaris_api.services.catalog import CatalogService
from lunaris_api.services.datasets import DatasetService
from lunaris_api.services.sites import SiteService
from lunaris_api.services.terrain import TerrainSceneService
from lunaris_api.settings import Settings
from lunaris_data.catalogs.sites import load_site_catalog


def get_app_settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def get_session(request: Request) -> Iterator[Session]:
    with request.app.state.session_factory() as session:
        yield session


def get_site_service(session: Annotated[Session, Depends(get_session)]) -> SiteService:
    return SiteService(SqlAlchemySiteRepository(session))


def get_dataset_service(request: Request) -> DatasetService:
    return DatasetService(request.app.state.dataset_registry, request.app.state.data_layout)


SettingsDep = Annotated[Settings, Depends(get_app_settings)]
SiteServiceDep = Annotated[SiteService, Depends(get_site_service)]
DatasetServiceDep = Annotated[DatasetService, Depends(get_dataset_service)]

__all__ = ["DatasetServiceDep", "SettingsDep", "SiteServiceDep"]


def get_terrain_scene_service(request: Request) -> TerrainSceneService:
    return TerrainSceneService(request.app.state.dataset_registry, request.app.state.data_layout)


TerrainSceneServiceDep = Annotated[TerrainSceneService, Depends(get_terrain_scene_service)]

# ── Ephemeris (S-GEOMETRY, T-22) ────────────────────────────────────────────
from lunaris_api.services.ephemeris import EphemerisService  # noqa: E402


def get_ephemeris_service(
    request: Request, sites: Annotated[SiteService, Depends(get_site_service)]
) -> EphemerisService:
    return EphemerisService(
        sites, request.app.state.dataset_registry, request.app.state.data_layout
    )


EphemerisServiceDep = Annotated[EphemerisService, Depends(get_ephemeris_service)]
__all__ += ["EphemerisServiceDep"]


# ── Horizon masks (S-TERRAIN, T-16) ──────────────────────────────────────────
from lunaris_api.services.horizon import HorizonMaskService  # noqa: E402


def get_horizon_mask_service(
    request: Request, sites: Annotated[SiteService, Depends(get_site_service)]
) -> HorizonMaskService:
    return HorizonMaskService(
        request.app.state.dataset_registry, request.app.state.data_layout, sites
    )


HorizonMaskServiceDep = Annotated[HorizonMaskService, Depends(get_horizon_mask_service)]
__all__ += ["HorizonMaskServiceDep"]


def get_catalog_service(
    sites: Annotated[SiteService, Depends(get_site_service)],
) -> CatalogService:
    return CatalogService(load_site_catalog(), sites)


CatalogServiceDep = Annotated[CatalogService, Depends(get_catalog_service)]
