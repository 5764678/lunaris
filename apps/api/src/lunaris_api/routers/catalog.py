"""Cited candidate-site catalogue (T-03)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Path, status

from lunaris_api.dependencies import CatalogServiceDep
from lunaris_api.schemas.catalog import RegisteredCatalogSites, SiteCatalogResponse
from lunaris_api.schemas.common import ERROR_RESPONSES, SERVER_ERROR, ErrorResponse
from lunaris_api.schemas.sites import CandidateSite

router = APIRouter(prefix="/catalog", tags=["catalog"])

CatalogSiteIdPath = Annotated[str, Path(pattern=r"^[a-z0-9][a-z0-9-]{1,63}$")]


@router.get(
    "/sites",
    response_model=SiteCatalogResponse,
    summary="Cited south-pole candidate-site catalogue",
    responses=SERVER_ERROR,
)
def get_site_catalog(service: CatalogServiceDep) -> SiteCatalogResponse:
    """The 27 PGDA product 78 sites with their sources, method, limitations and the
    definition of the reference point (the DEM tile centre, not a landing point)."""
    return service.catalog()


@router.post(
    "/sites/{catalog_site_id}/register",
    response_model=CandidateSite,
    status_code=status.HTTP_201_CREATED,
    summary="Add a catalogue site to the registry (origin: published)",
    responses={
        404: {"model": ErrorResponse, "description": "Unknown catalogue site."},
        409: {"model": ErrorResponse, "description": "Already registered, or registry full."},
        **ERROR_RESPONSES,
    },
)
def register_catalog_site(
    catalog_site_id: CatalogSiteIdPath, service: CatalogServiceDep
) -> CandidateSite:
    return service.register(catalog_site_id)


@router.post(
    "/demo-trio/register",
    response_model=RegisteredCatalogSites,
    summary="Add the three demo sites (demo_trio) to the registry in one action",
    responses={
        409: {"model": ErrorResponse, "description": "Registry full."},
        **SERVER_ERROR,
    },
)
def register_demo_trio(service: CatalogServiceDep) -> RegisteredCatalogSites:
    """Idempotent: sites already registered under the same name are returned, not duplicated."""
    return service.register_demo_trio()
