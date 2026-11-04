"""Versions of the geospatial / I-O toolchain used by the data layer."""

from __future__ import annotations

import importlib

from lunaris_data import __version__
from lunaris_science.runtime import RuntimeComponent


def _rasterio_versions() -> tuple[str | None, str | None, str | None]:
    try:
        rasterio = importlib.import_module("rasterio")
    except ImportError:
        return None, None, None
    proj = getattr(rasterio, "__proj_version__", None)
    return (
        str(rasterio.__version__),
        str(rasterio.__gdal_version__),
        str(proj) if proj is not None else None,
    )


def _version(module_name: str) -> str | None:
    try:
        return str(importlib.import_module(module_name).__version__)
    except (ImportError, AttributeError):
        return None


def data_runtime() -> tuple[RuntimeComponent, ...]:
    rasterio_version, gdal_version, proj_version = _rasterio_versions()
    return (
        RuntimeComponent("lunaris-data", __version__, "LUNARIS data layer"),
        RuntimeComponent("rasterio", rasterio_version, "raster I/O (Python)"),
        RuntimeComponent("gdal", gdal_version, "geospatial raster formats and projections"),
        RuntimeComponent("proj", proj_version, "cartographic projections (via GDAL)"),
        RuntimeComponent("httpx", _version("httpx"), "HTTP client for dataset acquisition"),
        RuntimeComponent("pydantic", _version("pydantic"), "manifest and record validation"),
    )


__all__ = ["data_runtime"]
