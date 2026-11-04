"""LUNARIS HTTP API (FastAPI)."""

from importlib.metadata import PackageNotFoundError, version

try:
    __version__ = version("lunaris-api")
except PackageNotFoundError:  # pragma: no cover - source tree without installation
    __version__ = "0.0.0+unknown"

API_VERSION = "v1"
"""Major version of the HTTP contract. Breaking changes require a new prefix."""

SERVICE_NAME = "lunaris-api"

__all__ = ["API_VERSION", "SERVICE_NAME", "__version__"]
