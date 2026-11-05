"""Terrain horizon mask of a site (T-16)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Path, Query

from lunaris_api.dependencies import HorizonMaskServiceDep
from lunaris_api.schemas.common import (
    SERVER_ERROR,
    ErrorResponse,
    EvidenceSchema,
    SourceReferenceSchema,
)
from lunaris_api.schemas.horizon import HorizonDemSchema, HorizonMaskResponse
from lunaris_api.services.horizon import DEFAULT_OBSERVER_HEIGHT_M, HORIZON_DATASET

router = APIRouter(prefix="/sites", tags=["terrain"])

SiteIdPath = Annotated[str, Path(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9-]+$")]


@router.get(
    "/{site_id}/horizon",
    response_model=HorizonMaskResponse,
    summary="Terrain horizon mask of a site (LOLA 240 m, 0.25° step, 200 km)",
    responses={
        404: {"model": ErrorResponse, "description": "Unknown site."},
        422: {
            "model": ErrorResponse,
            "description": "Invalid input or site outside LDEM coverage.",
        },
        503: {"model": ErrorResponse, "description": "LDEM not acquired or not verified."},
        **SERVER_ERROR,
    },
)
def get_site_horizon(
    site_id: SiteIdPath,
    service: HorizonMaskServiceDep,
    observer_height_m: Annotated[
        float, Query(ge=0, le=100, description="Eye height above the surface, m.")
    ] = DEFAULT_OBSERVER_HEIGHT_M,
) -> HorizonMaskResponse:
    """Horizon elevation versus azimuth computed by ray marching LDEM_75S_240M (curvature
    included, distances on the sphere). Computed once per site and parameters, then served
    from a file cache. Truncated azimuths are lower bounds."""
    mask = service.get_site_mask(site_id, observer_height_m=observer_height_m)
    manifest = service.manifest
    data = next(f for f in manifest.files if f.role.value == "data")
    truncated_count = int(mask.truncated.sum())
    limitations = [
        "DEM resolution 240 m: terrain features smaller than a few cells, and nearby "
        "relief within the first 240 m, are not resolved.",
        "Terrain beyond 200 km is not considered (it lies at least ~11.5 km below the "
        "site's horizontal plane at that range).",
    ]
    if truncated_count:
        limitations.insert(
            0,
            f"{truncated_count} of {mask.size} azimuths left LDEM coverage before "
            f"{mask.max_range_m / 1000:g} km: their horizon is a lower bound.",
        )
    source = SourceReferenceSchema(
        source_id=manifest.id,
        title=manifest.title,
        url=str(data.url),
        sha256=mask.dem_sha256,
        citation=manifest.citation,
    )
    return HorizonMaskResponse(
        site_id=site_id,
        latitude_deg=mask.site.latitude_deg,
        longitude_deg=mask.site.longitude_deg,
        observer_height_m=mask.observer_height_m,
        surface_height_m=mask.surface_height_m,
        azimuth_step_deg=mask.step_deg,
        azimuth_deg=mask.azimuth_deg.tolist(),
        elevation_deg=mask.elevation_deg.tolist(),
        truncated=mask.truncated.tolist(),
        truncated_count=truncated_count,
        max_range_m=mask.max_range_m,
        method=mask.method,
        dem=HorizonDemSchema(
            dataset_id=HORIZON_DATASET,
            title=manifest.title,
            sha256=mask.dem_sha256,
            resolution_m=mask.dem_resolution_m,
            source_url=str(data.url),
            citation=manifest.citation,
        ),
        evidence=EvidenceSchema(
            kind="calculation",
            statement=(
                "Terrain horizon computed by LUNARIS from the LOLA LDEM_75S_240M derived "
                "product (heights are the product's)."
            ),
            sources=[source],
            method=mask.method,
            assumptions=[
                f"Observer eye {mask.observer_height_m:g} m above the DEM surface"
                + (" (default)." if observer_height_m == DEFAULT_OBSERVER_HEIGHT_M else "."),
                "Local horizontal plane normal to the 1 737 400 m sphere's radial direction (C0).",
            ],
        ),
        limitations=limitations,
    )
