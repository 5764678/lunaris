"""Moon phases as seen from the Earth's centre (contract L1, ``docs/classroom/PLAN.md``).

Method (``docs/SCIENCE.md`` §5.2, "Moon phase series"):

1. Earth direction and sub-Earth point: the Moon-centred apparent direction of the Earth,
   ``moon_centred_direction(context, Body.EARTH, ...)`` (CSPICE
   ``spkpos('EARTH', et, 'MOON_ME', 'CN+S', 'MOON')``), the same call and aberration
   convention as the Moon-centred Sun direction (T-26).
2. Phase angle (Sun–Moon–Earth angle at the Moon's centre): CSPICE
   ``phaseq(et, 'MOON', 'SUN', 'EARTH', 'CN+S')``. The Moon is taken as seen from the
   geocentre (one Earth–Moon light time earlier) and the Sun as seen from the Moon at that
   epoch, which is the definition JPL Horizons uses for its S-T-O angle.
3. Illuminated fraction ``k = (1 + cos i) / 2`` for phase angle ``i`` (a sphere seen from
   far away).
4. Elongation (Sun–Earth–Moon angle at the Earth's centre): the angle between the apparent
   geocentric positions of the Sun and the Moon, ``spkpos(..., 'J2000', 'CN+S', 'EARTH')``.
5. Waxing: the apparent geocentric ecliptic longitude of the Moon minus that of the Sun,
   ``D = (λ☾ − λ☉) mod 360°``, lies in [0°, 180°). Longitudes in ``ECLIPJ2000``; the
   mean ecliptic of date is not available in the loaded kernel set, and the difference of
   two longitudes is insensitive to the equinox. The residual effect of the ecliptic plane
   tilt since J2000 is measured against Horizons in ``docs/SCIENCE.md``.

Principal phases (new Moon, first quarter, full Moon, last quarter) are the instants where
``D`` equals 0°, 90°, 180° and 270°; :func:`principal_phases` finds them by bracketing on
an hourly grid and bisecting to 0.01 s.

The phase is **geocentric** (D12): it is not the view from a site in Thailand, has no
topocentric parallax, and models neither libration-dependent brightness nor earthshine.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from enum import StrEnum

import numpy as np
import spiceypy
from numpy.typing import ArrayLike, NDArray
from spiceypy.utils.exceptions import SpiceyError

from lunaris_science.geometry.bodies import (
    APPARENT_CORRECTION,
    Body,
    GeometryError,
    MoonCentredSeries,
    moon_centred_direction,
)
from lunaris_science.geometry.spice import SpiceContext
from lunaris_science.provenance import Evidence, EvidenceKind

FloatArray = NDArray[np.float64]
BoolArray = NDArray[np.bool_]

ECLIPTIC_FRAME = "ECLIPJ2000"
EQUATORIAL_FRAME = "J2000"
SEARCH_STEP_S = 3600.0
"""Grid spacing used to bracket principal phases (D changes by ≈ 0.5° per hour)."""
BISECTION_TOLERANCE_S = 0.01


class PrincipalPhase(StrEnum):
    """The four principal phases, named by their target ``D = λ☾ − λ☉``."""

    NEW_MOON = "new_moon"
    FIRST_QUARTER = "first_quarter"
    FULL_MOON = "full_moon"
    LAST_QUARTER = "last_quarter"


PHASE_TARGET_DEG: dict[PrincipalPhase, float] = {
    PrincipalPhase.NEW_MOON: 0.0,
    PrincipalPhase.FIRST_QUARTER: 90.0,
    PrincipalPhase.FULL_MOON: 180.0,
    PrincipalPhase.LAST_QUARTER: 270.0,
}

MOON_PHASE_LIMITATIONS = (
    "Geocentric: the Moon as seen from the Earth's centre, north up (D12). It does not give "
    "the tilt of the lit side, the rise and set times, or the topocentric parallax "
    "(up to about 1°) for an observer in Thailand.",
    "The illuminated fraction is the geometric lit fraction of a smooth sphere's disk, "
    "(1 + cos(phase angle)) / 2. It is not brightness: libration, surface reflectance "
    "and earthshine are not modelled.",
    "Phase names and the lunar-calendar day (ค่ำ) are calendar conventions and are not "
    "computed here.",
)


@dataclass(frozen=True, slots=True)
class MoonPhaseSeries:
    """Geocentric Moon phase at a series of epochs (contract L1)."""

    epochs_et_s: FloatArray
    earth: MoonCentredSeries
    """Moon-centred apparent Earth direction; its sub-point is the sub-Earth point."""
    phase_angle_deg: FloatArray
    illuminated_fraction: FloatArray
    elongation_deg: FloatArray
    longitude_difference_deg: FloatArray
    """``D = (λ☾ − λ☉) mod 360°``, apparent geocentric, ``ECLIPJ2000``."""
    waxing: BoolArray
    aberration_correction: str
    evidence: Evidence


@dataclass(frozen=True, slots=True)
class PrincipalPhaseEvent:
    """One instant where ``D`` equals 0°, 90°, 180° or 270°."""

    phase: PrincipalPhase
    epoch_et_s: float


def _angle_deg(a: FloatArray, b: FloatArray) -> FloatArray:
    """Angle between row vectors, robust near 0° and 180° (atan2 of |a×b| and a·b)."""
    cross = np.linalg.norm(np.cross(a, b), axis=1)
    dot = np.sum(a * b, axis=1)
    return np.degrees(np.arctan2(cross, dot))


def _check_epochs(context: SpiceContext, epochs_et_s: ArrayLike) -> FloatArray:
    ets = np.atleast_1d(np.asarray(epochs_et_s, dtype=np.float64))
    if ets.ndim != 1 or not np.all(np.isfinite(ets)):
        raise GeometryError("epochs_et_s must be one-dimensional and finite")
    coverage = context.coverage
    if ets.size and (
        float(np.min(ets)) < coverage.start_et_s or float(np.max(ets)) > coverage.end_et_s
    ):
        raise GeometryError("epochs fall outside the time coverage of the loaded kernels")
    return ets


def _geocentric(context: SpiceContext, ets: FloatArray, frame: str) -> tuple[FloatArray, ...]:
    """Apparent geocentric positions (km) of the Sun and the Moon in ``frame``."""
    sun = np.empty((ets.size, 3), dtype=np.float64)
    moon = np.empty((ets.size, 3), dtype=np.float64)
    try:
        with context.session():
            for i, et in enumerate(ets):
                sun[i] = spiceypy.spkpos("SUN", float(et), frame, APPARENT_CORRECTION, "EARTH")[0]
                moon[i] = spiceypy.spkpos("MOON", float(et), frame, APPARENT_CORRECTION, "EARTH")[
                    0
                ]
    except SpiceyError as exc:
        raise GeometryError(f"SPICE could not compute geocentric positions: {exc.short}") from exc
    return sun, moon


def longitude_difference_deg(context: SpiceContext, epochs_et_s: ArrayLike) -> FloatArray:
    """``D = (λ☾ − λ☉) mod 360°``: apparent geocentric ecliptic longitudes, ``ECLIPJ2000``."""
    ets = _check_epochs(context, epochs_et_s)
    sun, moon = _geocentric(context, ets, ECLIPTIC_FRAME)
    lam_sun = np.degrees(np.arctan2(sun[:, 1], sun[:, 0]))
    lam_moon = np.degrees(np.arctan2(moon[:, 1], moon[:, 0]))
    return np.mod(lam_moon - lam_sun, 360.0)


def moon_phase_series(context: SpiceContext, epochs_et_s: ArrayLike) -> MoonPhaseSeries:
    """Geocentric Moon phase, sub-Earth point and Earth direction at each epoch (L1).

    Raises:
        GeometryError: for epochs outside the kernel coverage or a SPICE failure.
    """
    ets = _check_epochs(context, epochs_et_s)
    earth = moon_centred_direction(context, Body.EARTH, ets)

    phase = np.empty(ets.size, dtype=np.float64)
    try:
        with context.session():
            for i, et in enumerate(ets):
                phase[i] = spiceypy.phaseq(float(et), "MOON", "SUN", "EARTH", APPARENT_CORRECTION)
    except SpiceyError as exc:
        raise GeometryError(f"SPICE could not compute the phase angle: {exc.short}") from exc
    phase_deg = np.degrees(phase)
    fraction = (1.0 + np.cos(phase)) / 2.0

    sun_eq, moon_eq = _geocentric(context, ets, EQUATORIAL_FRAME)
    elongation = _angle_deg(sun_eq, moon_eq)
    difference = longitude_difference_deg(context, ets)
    waxing = difference < 180.0

    evidence = Evidence(
        kind=EvidenceKind.MODEL,
        statement=(
            "Moon phase as seen from the Earth's centre: phase angle, illuminated fraction, "
            "elongation and waxing or waning, with the apparent Earth direction and "
            "sub-Earth point on the Moon, from the JPL DE440 ephemeris through NAIF SPICE "
            f"(corrections {APPARENT_CORRECTION}). Validated against JPL Horizons "
            "(docs/SCIENCE.md §5.2)."
        ),
        sources=context.kernel_set.sources,
        method=(
            "Earth direction: CSPICE spkpos('EARTH', et, 'MOON_ME', 'CN+S', 'MOON'), unit "
            "vector; sub-Earth point = its planetocentric latitude/east longitude. Phase "
            "angle i: CSPICE phaseq(et, 'MOON', 'SUN', 'EARTH', 'CN+S'). Illuminated "
            "fraction = (1 + cos i) / 2. Elongation: angle between spkpos('SUN') and "
            "spkpos('MOON') from 'EARTH' (J2000, CN+S). Waxing: (λ_moon − λ_sun) mod 360° "
            "in [0°, 180°), apparent geocentric ecliptic longitudes in ECLIPJ2000. "
            f"MOON_ME resolves to {context.frame_resolution.resolves_to}."
        ),
        assumptions=(
            "Geocentric, not topocentric (D12).",
            "The disk is a smooth sphere; no libration-dependent brightness, no earthshine.",
            "Ecliptic longitudes in ECLIPJ2000 (mean ecliptic of J2000), not of date; the "
            "effect on phase instants is measured in docs/SCIENCE.md.",
        ),
    )
    return MoonPhaseSeries(
        epochs_et_s=ets,
        earth=earth,
        phase_angle_deg=phase_deg,
        illuminated_fraction=fraction,
        elongation_deg=elongation,
        longitude_difference_deg=difference,
        waxing=waxing,
        aberration_correction=APPARENT_CORRECTION,
        evidence=evidence,
    )


def _offset(context: SpiceContext, et: float, target_deg: float) -> float:
    """``D − target`` wrapped to (−180°, 180°]."""
    d = float(longitude_difference_deg(context, [et])[0])
    return (d - target_deg + 180.0) % 360.0 - 180.0


def principal_phases(
    context: SpiceContext, start_et_s: float, end_et_s: float
) -> list[PrincipalPhaseEvent]:
    """New Moon, first quarter, full Moon and last quarter instants in [start, end].

    ``D`` increases monotonically (by ≈ 12.2° per day), so each target is crossed once per
    lunation. Crossings are bracketed on a 1 h grid and refined by bisection to 0.01 s.
    """
    if not (math.isfinite(start_et_s) and math.isfinite(end_et_s)) or end_et_s < start_et_s:
        raise GeometryError("principal_phases needs a finite window with end >= start")
    count = int(math.floor((end_et_s - start_et_s) / SEARCH_STEP_S)) + 1
    grid = start_et_s + SEARCH_STEP_S * np.arange(count, dtype=np.float64)
    if grid[-1] < end_et_s:
        grid = np.append(grid, end_et_s)
    difference = longitude_difference_deg(context, grid)
    events: list[PrincipalPhaseEvent] = []
    for phase, target in PHASE_TARGET_DEG.items():
        offset = (difference - target + 180.0) % 360.0 - 180.0
        # A crossing is a sign change from negative to non-negative with a small jump
        # (the wrap from +180 to −180 is the opposite phase, not a crossing).
        crossings = np.nonzero((offset[:-1] < 0.0) & (offset[1:] >= 0.0))[0]
        for i in crossings:
            lo, hi = float(grid[i]), float(grid[i + 1])
            while hi - lo > BISECTION_TOLERANCE_S:
                mid = 0.5 * (lo + hi)
                if _offset(context, mid, target) < 0.0:
                    lo = mid
                else:
                    hi = mid
            events.append(PrincipalPhaseEvent(phase=phase, epoch_et_s=0.5 * (lo + hi)))
    events.sort(key=lambda event: event.epoch_et_s)
    return events


__all__ = [
    "MOON_PHASE_LIMITATIONS",
    "PHASE_TARGET_DEG",
    "MoonPhaseSeries",
    "PrincipalPhase",
    "PrincipalPhaseEvent",
    "longitude_difference_deg",
    "moon_phase_series",
    "principal_phases",
]
