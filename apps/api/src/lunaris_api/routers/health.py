from __future__ import annotations

import time

from fastapi import APIRouter, Request, Response
from sqlalchemy.exc import SQLAlchemyError

from lunaris_api import API_VERSION, SERVICE_NAME, __version__
from lunaris_api.db.engine import check_database
from lunaris_api.dependencies import SettingsDep
from lunaris_api.logging import get_logger
from lunaris_api.schemas.health import ComponentCheck, HealthResponse
from lunaris_data.store import utc_now

router = APIRouter(tags=["health"])
logger = get_logger("health")


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Service status and version",
    responses={503: {"model": HealthResponse, "description": "Service is degraded."}},
)
def health(request: Request, response: Response, settings: SettingsDep) -> HealthResponse:
    """Liveness/readiness of the API. Returns 200 when every check passes, 503 otherwise.

    Checks are cheap and side-effect free: a ``SELECT 1`` on the database, presence of
    the data directory, and the number of loaded dataset manifests.
    """
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
