from __future__ import annotations

import time

from fastapi import APIRouter, Request, Response
from sqlalchemy.exc import SQLAlchemyError

from lunaris_api import API_VERSION, SERVICE_NAME, __version__
from lunaris_api.db.engine import check_database
from lunaris_api.dependencies import SettingsDep
from lunaris_api.logging import get_logger
from lunaris_api.schemas.health import ComponentCheck, HealthResponse
from lunaris_data.registry import UnknownDatasetError
from lunaris_data.store import DatasetStatus, inspect_dataset, utc_now

router = APIRouter(tags=["health"])
logger = get_logger("health")


# Datasets every site analysis reads: SPICE kernels (Sun and Earth geometry) and the LOLA DEM
# (terrain horizon). The PGDA 20 m terrain product is read remotely, so it is not checked here.
READINESS_DATASETS = ("naif-generic-kernels-lunar", "lola-ldem-75s-240m")


def _liveness_checks(request: Request, settings: SettingsDep) -> list[ComponentCheck]:
    checks: list[ComponentCheck] = []

    try:
        check_database(request.app.state.engine)
        checks.append(ComponentCheck(name="database", status="ok"))
    except SQLAlchemyError:
        logger.exception("database health check failed")
        checks.append(ComponentCheck(name="database", status="unavailable", detail="query failed"))

    data_dir = settings.resolved_data_dir
    checks.append(
        ComponentCheck(name="data_directory", status="ok")
        if data_dir.is_dir()
        else ComponentCheck(
            name="data_directory", status="unavailable", detail="configured directory missing"
        )
    )

    registry = request.app.state.dataset_registry
    checks.append(
        ComponentCheck(
            name="dataset_registry", status="ok", detail=f"{len(registry)} manifests loaded"
        )
    )
    return checks


def _data_checks(request: Request) -> list[ComponentCheck]:
    """Whether the science datasets are on disk. Presence only: no hashing, no loading."""
    registry = request.app.state.dataset_registry
    layout = request.app.state.data_layout
    checks: list[ComponentCheck] = []
    for dataset_id in READINESS_DATASETS:
        name = f"dataset:{dataset_id}"
        try:
            state = inspect_dataset(registry.get(dataset_id), layout)
        except (UnknownDatasetError, OSError):
            logger.exception("dataset readiness check failed for %s", dataset_id)
            checks.append(ComponentCheck(name=name, status="unavailable", detail="cannot inspect"))
            continue
        if state.status == DatasetStatus.ACQUIRED:
            checks.append(ComponentCheck(name=name, status="ok"))
        else:
            checks.append(
                ComponentCheck(
                    name=name,
                    status="unavailable",
                    detail=f"{state.status.value}: run `uv run lunaris-data acquire {dataset_id}`",
                )
            )
    return checks


def _report(
    request: Request, response: Response, settings: SettingsDep, checks: list[ComponentCheck]
) -> HealthResponse:
    healthy = all(c.status == "ok" for c in checks)
    if not healthy:
        response.status_code = 503
    return HealthResponse(
        status="ok" if healthy else "degraded",
        service=SERVICE_NAME,
        version=__version__,
        api_version=API_VERSION,
        environment=settings.environment,
        time_utc=utc_now(),
        uptime_s=round(time.monotonic() - request.app.state.started_monotonic, 3),
        checks=checks,
    )


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Service status and version",
    responses={503: {"model": HealthResponse, "description": "Service is degraded."}},
)
def health(request: Request, response: Response, settings: SettingsDep) -> HealthResponse:
    """Liveness of the API. Returns 200 when every check passes, 503 otherwise.

    Checks are cheap and side-effect free: a ``SELECT 1`` on the database, presence of
    the data directory, and the number of loaded dataset manifests. Use this path for a
    host's health check and the container ``HEALTHCHECK``: it does not depend on the
    science datasets, so a missing download never makes the host restart the service.
    """
    return _report(request, response, settings, _liveness_checks(request, settings))


@router.get(
    "/health/ready",
    response_model=HealthResponse,
    summary="Readiness: liveness checks plus the science datasets",
    responses={503: {"model": HealthResponse, "description": "Not ready to analyse sites."}},
)
def ready(request: Request, response: Response, settings: SettingsDep) -> HealthResponse:
    """Everything ``/health`` checks, plus whether the SPICE kernels and the LOLA DEM are on
    disk. Returns 503 while either is missing, because site analysis would fail. Checks file
    presence only (no hashing; ``lunaris-data verify`` does that)."""
    checks = [*_liveness_checks(request, settings), *_data_checks(request)]
    return _report(request, response, settings, checks)
