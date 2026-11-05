"""Illumination and Earth-visibility timeline analysis (contract C4, T-24)."""

from __future__ import annotations

from fastapi import APIRouter

from lunaris_api.dependencies import TimelineServiceDep
from lunaris_api.schemas.common import ERROR_RESPONSES, ErrorResponse, ResponseDocs
from lunaris_api.schemas.illumination import TimelineAnalysis, TimelineRequest

router = APIRouter(prefix="/analysis", tags=["analysis"])

RESPONSES: ResponseDocs = {
    404: {"model": ErrorResponse, "description": "Unknown site."},
    503: {
        "model": ErrorResponse,
        "description": "SPICE kernels not acquired or failing verification on this server.",
    },
    **ERROR_RESPONSES,
}


@router.post(
    "/timeline",
    response_model=TimelineAnalysis,
    summary="Illumination and Earth-visibility timelines for a site",
    responses=RESPONSES,
)
def post_timeline(payload: TimelineRequest, service: TimelineServiceDep) -> TimelineAnalysis:
    """Visible fraction of the solar and Earth disks at every step from ``start_utc`` to
    ``end_utc``, against the astronomical horizon and, when a horizon mask exists, the
    terrain horizon (reported separately). Summaries: mean visible disk fraction,
    illuminated / visible fraction, longest illumination and darkness (or visibility and
    outage) with censoring, and windows. Same window rules, cap (10 000 samples) and error
    codes as the ephemeris endpoint. Earth results are geometric line of sight only and do
    not imply a radio link."""
    return service.timeline(payload)
