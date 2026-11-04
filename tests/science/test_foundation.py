"""Constants, frames, toolchain and module-boundary checks."""

from __future__ import annotations

import importlib
import inspect

import pytest

from lunaris_science.constants import LOLA_REFERENCE_SPHERE_RADIUS, MOON_MEAN_RADIUS
from lunaris_science.frames import CANONICAL_FRAME, LunarFrame
from lunaris_science.runtime import scientific_runtime


def test_reference_radii_are_cited_and_in_metres() -> None:
    for constant in (MOON_MEAN_RADIUS, LOLA_REFERENCE_SPHERE_RADIUS):
        assert constant.unit == "m"
        assert constant.source.strip()
        assert constant.value == 1_737_400.0


def test_canonical_frame_is_mean_earth() -> None:
    assert CANONICAL_FRAME is LunarFrame.MOON_ME
    assert {f.value for f in LunarFrame} == {"MOON_ME", "MOON_PA"}


def test_scientific_toolchain_is_complete() -> None:
    components = {c.name: c for c in scientific_runtime()}
    for name in ("python", "numpy", "scipy", "spiceypy", "cspice", "lunaris-science"):
        assert components[name].available, f"{name} is not importable"
    assert components["cspice"].version is not None
    assert components["cspice"].version.startswith("CSPICE_")


PLANNED_MODULES = ["terrain", "geometry", "illumination", "visibility", "energy", "scoring"]


@pytest.mark.parametrize("name", PLANNED_MODULES)
def test_planned_modules_expose_no_computations(name: str) -> None:
    """Planned modules must not contain functions or classes that could be mistaken for
    implemented science (no mock calculations)."""
    module = importlib.import_module(f"lunaris_science.{name}")
    assert module.__doc__
    assert "Not implemented" in module.__doc__
    public = [
        member
        for member_name, member in inspect.getmembers(module)
        if not member_name.startswith("_")
        and (inspect.isfunction(member) or inspect.isclass(member))
    ]
    assert public == []
