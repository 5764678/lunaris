from __future__ import annotations

from fastapi import APIRouter

from lunaris_api import API_VERSION, __version__
from lunaris_api.dependencies import SettingsDep
from lunaris_api.schemas.common import SERVER_ERROR
from lunaris_api.schemas.system import RuntimeComponentSchema, RuntimeReport
from lunaris_data.runtime import data_runtime
from lunaris_science.runtime import scientific_runtime

router = APIRouter(prefix="/system", tags=["system"])


@router.get(
    "/runtime",
    response_model=RuntimeReport,
    summary="Scientific toolchain versions",
    responses=SERVER_ERROR,
)
def runtime(settings: SettingsDep) -> RuntimeReport:
    """Versions of the numerical, geospatial and SPICE libraries serving this API.

    Recorded so that every future analysis result can state the software that produced it.
    """
    components = [
        RuntimeComponentSchema(
            name=c.name, version=c.version, available=c.available, purpose=c.purpose
        )
        for c in (*scientific_runtime(), *data_runtime())
    ]
    return RuntimeReport(
        service_version=__version__,
        api_version=API_VERSION,
        environment=settings.environment,
        components=components,
    )
