from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Path, Response, status

from lunaris_api.dependencies import SettingsDep, SiteServiceDep
from lunaris_api.schemas.common import ERROR_RESPONSES, SERVER_ERROR, ErrorResponse, ResponseDocs
from lunaris_api.schemas.sites import CandidateSite, CandidateSiteCreate, CandidateSiteList

router = APIRouter(prefix="/sites", tags=["sites"])

SiteIdPath = Annotated[str, Path(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9-]+$")]
NOT_FOUND: ResponseDocs = {404: {"model": ErrorResponse, "description": "Unknown site."}}
CONFLICT: ResponseDocs = {
    409: {"model": ErrorResponse, "description": "Duplicate name or registry limit reached."}
}


@router.get(
    "",
    response_model=CandidateSiteList,
    summary="List candidate sites",
    responses=SERVER_ERROR,
)
def list_sites(service: SiteServiceDep) -> CandidateSiteList:
    return service.list_sites()


@router.post(
    "",
    response_model=CandidateSite,
    status_code=status.HTTP_201_CREATED,
    summary="Register a user-defined candidate site",
    responses={**CONFLICT, **ERROR_RESPONSES},
)
def create_site(payload: CandidateSiteCreate, service: SiteServiceDep) -> CandidateSite:
    """Register a site by planetocentric coordinates in MOON_ME. Longitude is normalized to
    [0, 360). Site names are unique (case-insensitive)."""
    return service.create_site(payload)


@router.get(
    "/{site_id}",
    response_model=CandidateSite,
    summary="Get a candidate site",
    responses={**NOT_FOUND, **ERROR_RESPONSES},
)
def get_site(site_id: SiteIdPath, service: SiteServiceDep) -> CandidateSite:
    return service.get_site(site_id)


@router.delete(
    "/{site_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a candidate site",
    responses={**NOT_FOUND, **ERROR_RESPONSES},
)
def delete_site(site_id: SiteIdPath, service: SiteServiceDep, settings: SettingsDep) -> Response:
    # 403 for cited sites when LUNARIS_PROTECT_PUBLISHED_SITES is on. Deliberately a comment, not
    # a docstring or a `responses` entry: those would change the committed OpenAPI contract.
    service.delete_site(site_id, protect_published=settings.protect_published_sites)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
