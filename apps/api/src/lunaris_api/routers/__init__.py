"""HTTP routers. Each module owns one resource; ``api_v1`` aggregates versioned routes."""

from fastapi import APIRouter

from lunaris_api.routers import catalog, datasets, ephemeris, health, sites, system, terrain

api_v1 = APIRouter(prefix="/api/v1")
api_v1.include_router(system.router)
api_v1.include_router(datasets.router)
api_v1.include_router(sites.router)
api_v1.include_router(catalog.router)
api_v1.include_router(terrain.router)
api_v1.include_router(ephemeris.router)

__all__ = ["api_v1", "health"]
