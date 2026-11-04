from __future__ import annotations

from lunaris_api.schemas.common import Schema


class RuntimeComponentSchema(Schema):
    name: str
    version: str | None
    available: bool
    purpose: str


class RuntimeReport(Schema):
    """Versions of the scientific and data toolchain serving this API (reproducibility)."""

    service_version: str
    api_version: str
    environment: str
    components: list[RuntimeComponentSchema]


__all__ = ["RuntimeComponentSchema", "RuntimeReport"]
