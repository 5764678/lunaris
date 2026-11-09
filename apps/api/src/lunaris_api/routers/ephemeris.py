"""Site ephemeris: apparent Sun and Earth geometry over a UTC window (contract C2)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Path, Query
from pydantic import AwareDatetime

from lunaris_api.dependencies import EphemerisServiceDep
from lunaris_api.schemas.common import ERROR_RESPONSES, ErrorResponse, ResponseDocs
from lunaris_api.schemas.ephemeris import (
    MAX_STEP_S,
    MIN_STEP_S,
    SiteEphemeris,
    SunDirectionSeries,
)

router = APIRouter(prefix="/sites", tags=["ephemeris"])
sun_router = APIRouter(prefix="/ephemeris", tags=["ephemeris"])

SiteIdPath = Annotated[str, Path(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9-]+$")]
RESPONSES: ResponseDocs = {
    404: {"model": ErrorResponse, "description": "Unknown site."},
    503: {
        "model": ErrorResponse,
        "description": "SPICE kernels not acquired or failing verification on this server.",
    },
    **ERROR_RESPONSES,
}


@router.get(
    "/{site_id}/ephemeris",
    response_model=SiteEphemeris,
    summary="Sun and Earth geometry for a site",
    responses=RESPONSES,
)
def get_site_ephemeris(
    site_id: SiteIdPath,
    start_utc: Annotated[AwareDatetime, Query(description="Window start, ISO 8601 UTC.")],
    end_utc: Annotated[
        AwareDatetime, Query(description="Window end (inclusive when on a step), ISO 8601 UTC.")
    ],
    step_s: Annotated[
        float, Query(ge=MIN_STEP_S, le=MAX_STEP_S, description="Sample spacing in seconds.")
    ],
    service: EphemerisServiceDep,
) -> SiteEphemeris:
    """Apparent azimuth, elevation, range, angular radius and MOON_ME direction of the Sun
    and the Earth from the site, every ``step_s`` seconds from ``start_utc`` to
    ``end_utc``. Computed locally with NAIF SPICE (DE440, corrections CN+S). At most
    10 000 samples per request; more gives 422 ``sample_cap_exceeded``."""
    return service.site_ephemeris(site_id, start_utc, end_utc, step_s)


SUN_RESPONSES: ResponseDocs = {
    503: {
        "model": ErrorResponse,
        "description": "SPICE kernels not acquired or failing verification on this server.",
    },
    **ERROR_RESPONSES,
}


@sun_router.get(
    "/sun",
    response_model=SunDirectionSeries,
    summary="Moon-centred apparent Sun direction (for lighting the globe)",
    responses=SUN_RESPONSES,
)
def get_sun_direction(
    start_utc: Annotated[AwareDatetime, Query(description="Window start, ISO 8601 UTC.")],
    end_utc: Annotated[
        AwareDatetime,
        Query(description="Window end (inclusive when on a step); start = end gives one epoch."),
    ],
    step_s: Annotated[
        float, Query(ge=MIN_STEP_S, le=MAX_STEP_S, description="Sample spacing in seconds.")
    ],
    service: EphemerisServiceDep,
) -> SunDirectionSeries:
    """Apparent unit direction from the Moon's centre to the Sun in MOON_ME (CN+S), the
    sub-solar point and the solar angular radius at every step. Same window rules,
    10 000-sample cap and error codes as the site ephemeris."""
    return service.sun_direction(start_utc, end_utc, step_s)
