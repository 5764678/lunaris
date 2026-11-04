"""Reference constants with explicit units and sources.

Only constants that LUNARIS code actually uses are defined here. Each is a
:class:`ReferenceConstant` carrying its unit and a citation so that values can be
traced in reports.

These values are *published reference values or product conventions*. They are not
measurements made by LUNARIS. Where a value is a product convention (for example the
radius of the sphere that LOLA heights are referred to), the authoritative source is
the label of the specific product in use, and code that ingests that product must
read the value from the label rather than assume this constant.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ReferenceConstant:
    """A named reference value with unit and source."""

    symbol: str
    value: float
    unit: str
    description: str
    source: str


MOON_MEAN_RADIUS = ReferenceConstant(
    symbol="R_moon",
    value=1_737_400.0,
    unit="m",
    description=(
        "Mean radius of the Moon adopted by the IAU Working Group on Cartographic "
        "Coordinates and Rotational Elements (WGCCRE)."
    ),
    source=(
        "Archinal, B. A., et al. (2018). Report of the IAU Working Group on Cartographic "
        "Coordinates and Rotational Elements: 2015. Celestial Mechanics and Dynamical "
        "Astronomy, 130, 22. doi:10.1007/s10569-017-9805-5"
    ),
)

LOLA_REFERENCE_SPHERE_RADIUS = ReferenceConstant(
    symbol="R_ref",
    value=1_737_400.0,
    unit="m",
    description=(
        "Radius of the reference sphere to which LOLA gridded topography heights are "
        "referred. Numerically equal to MOON_MEAN_RADIUS but semantically distinct: it is "
        "a data-product convention. Ingestion code must confirm it against the PDS label "
        "of the product actually used."
    ),
    source=(
        "NASA PDS Geosciences Node, LRO LOLA Gridded Data Record (GDR) product labels; "
        "LRO Project and LGCWG (2008), 'A Standardized Lunar Coordinate System for the "
        "Lunar Reconnaissance Orbiter and Lunar Datasets' (white paper)."
    ),
)

__all__ = ["LOLA_REFERENCE_SPHERE_RADIUS", "MOON_MEAN_RADIUS", "ReferenceConstant"]
