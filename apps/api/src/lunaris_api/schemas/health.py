from __future__ import annotations

from typing import Literal

from pydantic import AwareDatetime, Field

from lunaris_api.schemas.common import Schema

CheckStatus = Literal["ok", "unavailable"]


class ComponentCheck(Schema):
    name: str
    status: CheckStatus
    detail: str | None = None


class HealthResponse(Schema):
    """Service liveness and readiness. HTTP 200 when ``ok``, 503 when ``degraded``."""

    status: Literal["ok", "degraded"]
    service: Literal["lunaris-api"]
    version: str = Field(description="Release version of the API service.")
    api_version: Literal["v1"] = Field(description="Major version of the HTTP contract.")
    environment: Literal["development", "test", "production"]
    time_utc: AwareDatetime
    uptime_s: float = Field(ge=0)
    checks: list[ComponentCheck]


__all__ = ["CheckStatus", "ComponentCheck", "HealthResponse"]
