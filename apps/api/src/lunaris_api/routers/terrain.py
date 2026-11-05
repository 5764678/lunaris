"""Terrain scene export (contract C3): metadata as JSON, vertices as binary."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Header, Path, Query, Response

from lunaris_api.dependencies import (
    SiteServiceDep,
    SiteTerrainServiceDep,
    TerrainSceneServiceDep,
)
from lunaris_api.schemas.common import ERROR_RESPONSES, SERVER_ERROR, ErrorResponse, ResponseDocs
from lunaris_api.schemas.terrain import (
    SiteTerrainResponse,
    TerrainSceneListResponse,
    TerrainSceneMetadata,
)
from lunaris_api.services.terrain import DEFAULT_GRID_SIZE, MAX_FOOTPRINT_RADIUS_M, SceneResult
from lunaris_science.terrain.analysis import HazardThresholds
from lunaris_science.terrain.scene import MAX_SCENE_VERTICES_PER_SIDE

router = APIRouter(prefix="/terrain", tags=["terrain"])

SceneIdPath = Annotated[str, Path(pattern=r"^[a-z0-9][a-z0-9-]{1,63}$")]
GridSizeQuery = Annotated[
    int,
    Query(
        ge=2,
        le=MAX_SCENE_VERTICES_PER_SIDE,
        description="Vertices per side of the square grid (contract cap 1024).",
    ),
]
IfNoneMatchHeader = Annotated[str | None, Header()]
CACHE_CONTROL = "public, max-age=3600"
SCENE_ERRORS: ResponseDocs = {
    304: {"description": "Not modified (If-None-Match matched the ETag)."},
    404: {"model": ErrorResponse, "description": "Unknown scene."},
    503: {"model": ErrorResponse, "description": "Source DEM not acquired or not verified."},
    **ERROR_RESPONSES,
}


def _cache_headers(result: SceneResult) -> dict[str, str]:
    return {"ETag": result.etag, "Cache-Control": CACHE_CONTROL}


def _not_modified(if_none_match: str | None, etag: str) -> bool:
    if not if_none_match:
        return False
    candidates = {tag.strip().removeprefix("W/") for tag in if_none_match.split(",")}
    return etag in candidates or "*" in candidates


@router.get(
    "/scenes",
    response_model=TerrainSceneListResponse,
    summary="Available terrain scenes",
    responses=SERVER_ERROR,
)
def list_scenes(service: TerrainSceneServiceDep) -> TerrainSceneListResponse:
    """Scenes LUNARIS can export, and whether each one's source DEM is acquired."""
    return service.list_scenes()


@router.get(
    "/scenes/{scene_id}",
    response_model=TerrainSceneMetadata,
    summary="Terrain scene metadata",
    responses=SCENE_ERRORS,
)
def get_scene_metadata(
    scene_id: SceneIdPath,
    service: TerrainSceneServiceDep,
    response: Response,
    grid_size: GridSizeQuery = DEFAULT_GRID_SIZE,
    if_none_match: IfNoneMatchHeader = None,
) -> TerrainSceneMetadata | Response:
    """Vertex-grid metadata, provenance and the URL of the binary vertex data.

    Positions are already in MOON_ME (relative to ``origin_moon_me_m``); clients never
    re-implement the polar stereographic inverse."""
    result = service.get_scene(scene_id, grid_size)
    headers = _cache_headers(result)
    if _not_modified(if_none_match, result.etag):
        return Response(status_code=304, headers=headers)
    response.headers.update(headers)
    return service.metadata(result)


@router.get(
    "/scenes/{scene_id}/data",
    summary="Terrain scene vertex data (binary)",
    response_class=Response,
    responses={
        200: {
            "content": {"application/octet-stream": {}},
            "description": "Little-endian float32, row-major, 4 values per vertex: x, y, z "
            "(m, MOON_ME, relative to origin_moon_me_m) and height_m. NaN vertices have "
            "no DEM value and must not be drawn.",
        },
        **SCENE_ERRORS,
    },
)
def get_scene_data(
    scene_id: SceneIdPath,
    service: TerrainSceneServiceDep,
    grid_size: GridSizeQuery = DEFAULT_GRID_SIZE,
    if_none_match: IfNoneMatchHeader = None,
) -> Response:
    result = service.get_scene(scene_id, grid_size)
    headers = _cache_headers(result)
    if _not_modified(if_none_match, result.etag):
        return Response(status_code=304, headers=headers)
    return Response(
        content=result.scene.to_bytes(),
        media_type="application/octet-stream",
        headers=headers,
    )


site_router = APIRouter(prefix="/sites", tags=["terrain"])

SitePath = Annotated[str, Path(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9-]+$")]


@site_router.get(
    "/{site_id}/terrain",
    response_model=SiteTerrainResponse,
    summary="Terrain analysis at a site (height, slope, roughness, hazards)",
    responses={
        404: {"model": ErrorResponse, "description": "Unknown site."},
        422: {"model": ErrorResponse, "description": "Invalid input or site outside coverage."},
        503: {"model": ErrorResponse, "description": "DEM window could not be read."},
        **SERVER_ERROR,
    },
)
def get_site_terrain(
    site_id: SitePath,
    sites: SiteServiceDep,
    service: SiteTerrainServiceDep,
    *,
    footprint_radius_m: Annotated[
        float, Query(gt=0, le=MAX_FOOTPRINT_RADIUS_M, description="Footprint radius, m.")
    ] = 50.0,
    max_slope_deg: Annotated[
        float | None, Query(gt=0, lt=90, description="Hazard threshold (assumption).")
    ] = None,
    max_roughness_m: Annotated[
        float | None, Query(gt=0, description="Hazard threshold (assumption).")
    ] = None,
) -> SiteTerrainResponse:
    """Height (bilinear), Horn slope with scale-corrected spacing, plane-fit RMS roughness
    and footprint statistics from a window of the PGDA LOLA 20 m south-pole DEM. Every
    slope and roughness carries its baseline. Hazard flags appear only when thresholds
    are supplied; they are the caller's assumptions."""
    site = sites.get_site(site_id)
    thresholds = (
        HazardThresholds(max_slope_deg=max_slope_deg, max_roughness_m=max_roughness_m)
        if max_slope_deg is not None or max_roughness_m is not None
        else None
    )
    return service.analyze(site, footprint_radius_m=footprint_radius_m, thresholds=thresholds)
