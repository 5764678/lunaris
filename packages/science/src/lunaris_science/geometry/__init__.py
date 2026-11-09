"""Celestial geometry (Milestone 03): Sun and Earth seen from a lunar surface site.

Implemented:

* :mod:`~lunaris_science.geometry.spice` — the process-wide SPICE kernel context: loads
  one checksum-verified kernel set from explicit paths, checks that ``MOON_ME`` resolves
  to ``MOON_ME_DE440_ME421``, and serializes every CSPICE call through one lock (C2).
* :mod:`~lunaris_science.geometry.epochs` — UTC grids and UTC → ET conversion.
* :mod:`~lunaris_science.geometry.bodies` — apparent azimuth, elevation, range, angular
  radius and ``MOON_ME`` direction of the Sun and the Earth (contract C2), validated
  against JPL Horizons (``docs/SCIENCE.md`` §5.2).

Conventions are those of contract C0 in ``docs/TASKS.md``.
"""

from lunaris_science.geometry.bodies import (
    APPARENT_CORRECTION,
    Body,
    BodyGeometrySeries,
    GeometryError,
    MoonCentredSeries,
    ObserverSite,
    body_geometry,
    enu_basis,
    moon_centred_direction,
    topocentric_az_el,
)
from lunaris_science.geometry.epochs import EpochError, sample_count, uniform_utc_grid, utc_to_et
from lunaris_science.geometry.spice import (
    SPICE_LOCK,
    KernelFile,
    KernelRole,
    KernelSet,
    SpiceContext,
    SpiceKernelError,
    TimeCoverage,
)

__all__ = [
    "APPARENT_CORRECTION",
    "SPICE_LOCK",
    "Body",
    "BodyGeometrySeries",
    "EpochError",
    "GeometryError",
    "KernelFile",
    "KernelRole",
    "KernelSet",
    "MoonCentredSeries",
    "ObserverSite",
    "SpiceContext",
    "SpiceKernelError",
    "TimeCoverage",
    "body_geometry",
    "enu_basis",
    "moon_centred_direction",
    "sample_count",
    "topocentric_az_el",
    "uniform_utc_grid",
    "utc_to_et",
]
