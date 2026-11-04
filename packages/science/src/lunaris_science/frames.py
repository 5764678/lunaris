"""Body-fixed lunar reference frames.

LUNARIS expresses every surface position in a *named* body-fixed frame. Two frames
matter for lunar work:

``MOON_ME`` — Mean Earth / Polar Axis frame
    +Z along the mean rotation (polar) axis, +X toward the mean direction of the
    Earth (the prime meridian), +Y completing a right-handed system (90° E). This is
    the frame adopted by the LRO project for lunar cartographic products, including
    LOLA topography. **It is the canonical LUNARIS frame.**

``MOON_PA`` — Principal Axis frame
    Aligned with the Moon's principal axes of inertia and realized by the JPL lunar
    ephemeris (for example DE440 through the NAIF binary PCK
    ``moon_pa_de440_*.bpc``). It differs from ``MOON_ME`` by a small fixed rotation
    (tens of arcseconds, i.e. several hundred metres at the surface). The exact
    angles are defined in the NAIF lunar frames kernel; LUNARIS will obtain them from
    SPICE, never hard-code them.

References: LRO Project and LGCWG (2008) white paper "A Standardized Lunar Coordinate
System for the Lunar Reconnaissance Orbiter and Lunar Datasets"; NAIF lunar frames
kernel comments (``moon_de440_*.tf``).
"""

from __future__ import annotations

from enum import StrEnum


class LunarFrame(StrEnum):
    """Identifiers of body-fixed lunar frames (SPICE frame names)."""

    MOON_ME = "MOON_ME"
    MOON_PA = "MOON_PA"


CANONICAL_FRAME = LunarFrame.MOON_ME
"""Frame in which LUNARIS stores and exchanges surface coordinates."""

__all__ = ["CANONICAL_FRAME", "LunarFrame"]
