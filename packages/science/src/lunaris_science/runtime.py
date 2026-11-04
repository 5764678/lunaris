"""Scientific toolchain report.

Reproducible results require knowing exactly which numerical libraries produced them.
:func:`scientific_runtime` reports the versions of the libraries the scientific core
depends on. Future analysis results embed this report in their provenance.
"""

from __future__ import annotations

import importlib
import platform
from dataclasses import dataclass

from lunaris_science import __version__


@dataclass(frozen=True, slots=True)
class RuntimeComponent:
    """A library in the scientific toolchain and the role it plays."""

    name: str
    version: str | None
    purpose: str

    @property
    def available(self) -> bool:
        return self.version is not None


def _module_version(module_name: str) -> str | None:
    try:
        module = importlib.import_module(module_name)
    except ImportError:
        return None
    return str(getattr(module, "__version__", "unknown"))


def _cspice_toolkit_version() -> str | None:
    try:
        spiceypy = importlib.import_module("spiceypy")
    except ImportError:
        return None
    return str(spiceypy.tkvrsn("TOOLKIT"))


def scientific_runtime() -> tuple[RuntimeComponent, ...]:
    """Return the versions of the scientific core's toolchain.

    Components that fail to import are reported with ``version=None`` instead of
    raising, so that a status endpoint can display a broken installation.
    """
    return (
        RuntimeComponent("python", platform.python_version(), "interpreter"),
        RuntimeComponent("lunaris-science", __version__, "LUNARIS scientific core"),
        RuntimeComponent("numpy", _module_version("numpy"), "array computation"),
        RuntimeComponent("scipy", _module_version("scipy"), "numerical methods"),
        RuntimeComponent("spiceypy", _module_version("spiceypy"), "Python bindings to SPICE"),
        RuntimeComponent(
            "cspice", _cspice_toolkit_version(), "NAIF SPICE toolkit (ephemeris geometry)"
        ),
    )


__all__ = ["RuntimeComponent", "scientific_runtime"]
