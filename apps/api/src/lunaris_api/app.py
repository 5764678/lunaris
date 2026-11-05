"""Application factory."""

from __future__ import annotations

import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from lunaris_api import API_VERSION, __version__
from lunaris_api.db.engine import (
    create_schema,
    describe_database,
    make_engine,
    make_session_factory,
)
from lunaris_api.errors import register_exception_handlers
from lunaris_api.logging import configure_logging
from lunaris_api.middleware import REQUEST_ID_HEADER, RequestContextMiddleware
from lunaris_api.routers import api_v1, health
from lunaris_api.settings import Settings, get_settings
from lunaris_data.registry import DatasetRegistry
from lunaris_data.store import DataLayout

DESCRIPTION = """
LUNARIS — Lunar Mission Intelligence & Surface Operations Platform.

Milestone 01 API: service health, scientific toolchain report, dataset registry with
local provenance status, and a registry of user-defined candidate sites.

Conventions: snake_case fields; units as suffixes (`_deg`, `_m`, `_s`, `_bytes`);
timestamps ISO 8601 UTC; coordinates planetocentric in the MOON_ME frame with east
longitude in [0, 360). Every non-2xx response uses the `ErrorResponse` envelope.

LUNARIS is a preliminary mission-planning and research tool, not a certified
spacecraft landing system.
""".strip()


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    logger = configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        layout = DataLayout.from_root(settings.data_dir)
        layout.state.mkdir(parents=True, exist_ok=True)
        engine = make_engine(settings.resolved_database_url)
        create_schema(engine)
        app.state.settings = settings
        app.state.data_layout = layout
        app.state.engine = engine
        app.state.session_factory = make_session_factory(engine)
        app.state.dataset_registry = DatasetRegistry.load_builtin()
        app.state.started_monotonic = time.monotonic()
        logger.info(
            "lunaris-api %s starting (env=%s, data_dir=%s, database=%s, cors=%s)",
            __version__,
            settings.environment,
            layout.root,
            describe_database(settings.resolved_database_url),
            ",".join(settings.cors_origins),
        )
        try:
            yield
        finally:
            engine.dispose()

    app = FastAPI(
        title="LUNARIS API",
        version=__version__,
        summary="Lunar Mission Intelligence & Surface Operations Platform",
        description=DESCRIPTION,
        lifespan=lifespan,
        docs_url="/docs" if settings.docs_enabled else None,
        redoc_url="/redoc" if settings.docs_enabled else None,
        openapi_url="/openapi.json" if settings.docs_enabled else None,
        openapi_tags=[
            {"name": "health", "description": "Service status."},
            {"name": "system", "description": "Runtime and toolchain information."},
            {"name": "datasets", "description": "Dataset registry and local provenance status."},
            {"name": "sites", "description": "User-defined candidate landing sites."},
            {"name": "ephemeris", "description": "Sun and Earth geometry from a site (SPICE)."},
        ],
    )
    app.state.api_version = API_VERSION

    register_exception_handlers(app)
    # Order matters: the last middleware added is the outermost. CORS must wrap the
    # request-context middleware so that its 500 responses also carry CORS headers.
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-Request-ID"],
        expose_headers=[REQUEST_ID_HEADER],
        max_age=600,
    )

    app.include_router(health.router)
    app.include_router(api_v1)
    return app


__all__ = ["create_app"]
