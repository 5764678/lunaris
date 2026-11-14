"""Site comparison table (T-17)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Query

from lunaris_api.dependencies import CompareServiceDep
from lunaris_api.schemas.common import ERROR_RESPONSES, ErrorResponse
from lunaris_api.schemas.compare import Mission, MissionLimits, Priority, SiteComparison
from lunaris_api.services.compare import DEFAULT_FOOTPRINT_RADIUS_M, MAX_COMPARE_SITES

router = APIRouter(prefix="/analysis", tags=["compare"])

DEFAULT_START = datetime(2027, 1, 1, tzinfo=UTC)
DEFAULT_END = datetime(2028, 1, 1, tzinfo=UTC)


@router.get(
    "/site-comparison",
    response_model=SiteComparison,
    summary="Compare sites: terrain, horizon, illumination and Earth visibility",
    responses={404: {"model": ErrorResponse, "description": "Unknown site."}, **ERROR_RESPONSES},
)
def compare_sites(
    service: CompareServiceDep,
    *,
    site_ids: Annotated[
        str, Query(description=f"Comma-separated site ids (1–{MAX_COMPARE_SITES}).")
    ],
    start_utc: Annotated[
        datetime, Query(description="Window start, ISO 8601 UTC.")
    ] = DEFAULT_START,
    end_utc: Annotated[datetime, Query(description="Window end, ISO 8601 UTC.")] = DEFAULT_END,
    step_s: Annotated[float, Query(gt=0, description="Time step, s.")] = 3600.0,
    observer_height_m: Annotated[float, Query(ge=0, le=100)] = 2.0,
    footprint_radius_m: Annotated[float, Query(gt=0, le=2000)] = DEFAULT_FOOTPRINT_RADIUS_M,
    power: Annotated[
        Priority,
        Query(description="How much the mission depends on sunlight (none = e.g. nuclear)."),
    ] = "medium",
    comms: Annotated[
        Priority,
        Query(description="How much it depends on direct line of sight to Earth (none = relay)."),
    ] = "medium",
    landing: Annotated[
        Priority, Query(description="How much it needs gentle, smooth terrain.")
    ] = "medium",
    max_slope_deg: Annotated[
        float | None,
        Query(gt=0, le=90, description="Limit: steepest slope (at the site and footprint p95)."),
    ] = None,
    max_darkness_d: Annotated[
        float | None, Query(gt=0, description="Limit: longest darkness survivable, days.")
    ] = None,
    max_earth_outage_d: Annotated[
        float | None, Query(gt=0, description="Limit: longest gap without Earth in view, days.")
    ] = None,
    min_sunlit_d: Annotated[
        float | None, Query(gt=0, description="Limit: continuous sunlight required, days.")
    ] = None,
) -> SiteComparison:
    """One row per site; every cell carries its own evidence (kind, method, sources with
    manifest id and SHA-256 or URL/ETag, units, limitations). A cell that cannot be
    computed is null with a `reason`, never 0. The default window is calendar year 2027
    at a 1 h step (8 761 samples, within the ephemeris sample cap).

    The `summary.recommendation` names the best-fitting site for the stated mission: how
    much it needs power, comms and landing safety (`none|low|medium|high`) and optional hard
    limits. Sites that break a limit are excluded with the reason, never down-weighted;
    every weight and scale is returned as assumption evidence."""
    return service.compare(
        site_ids.split(","),
        start_utc,
        end_utc,
        step_s,
        observer_height_m=observer_height_m,
        footprint_radius_m=footprint_radius_m,
        mission=Mission(
            power=power,
            comms=comms,
            landing=landing,
            limits=MissionLimits(
                max_slope_deg=max_slope_deg,
                max_darkness_d=max_darkness_d,
                max_earth_outage_d=max_earth_outage_d,
                min_sunlit_d=min_sunlit_d,
            ),
        ),
    )
