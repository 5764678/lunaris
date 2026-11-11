"""Apparent Sun and Earth geometry from a lunar surface site (contract C2).

Method (``docs/SCIENCE.md`` §5.2):

1. Observer position **s** in ``MOON_ME`` on the reference sphere,
   ``R = 1 737 400 m + surface height + observer height``.
2. Apparent target position relative to the observer, light time (converged Newtonian)
   and stellar aberration (``CN+S``), from CSPICE ``spkcpo`` with the observer fixed in
   ``MOON_ME`` and the output in ``MOON_ME`` evaluated at the observer epoch.
3. Local east-north-up basis from the **reference-sphere radial direction** (C0):
   up = ŝ, east = ẑ × up / |ẑ × up|, north = up × east.
4. Azimuth = atan2(E, N) mod 360° (clockwise from north), elevation = asin(U / |r|),
   angular radius = asin(R_body / |r|) with R_body from the loaded PCK (``bodvrd``).

The local frame is undefined at latitude exactly ±90°; such sites are rejected (D2).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import StrEnum

import numpy as np
import spiceypy
from numpy.typing import ArrayLike, NDArray
from spiceypy.utils.exceptions import SpiceyError

from lunaris_science.constants import LOLA_REFERENCE_SPHERE_RADIUS
from lunaris_science.coordinates import (
    LATITUDE_LIMIT_DEG,
    CoordinateError,
    SelenographicCoordinate,
    cartesian_to_spherical,
    spherical_to_cartesian,
)
from lunaris_science.frames import CANONICAL_FRAME
from lunaris_science.geometry.spice import CANONICAL_FRAME_NAME, SpiceContext
from lunaris_science.provenance import Evidence, EvidenceKind

FloatArray = NDArray[np.float64]

KM = 1000.0
FULL_TURN_DEG = 360.0
POLAR_AXIS_EPSILON = 1e-15
"""|ẑ × up| below which the site is treated as on the polar axis."""
APPARENT_CORRECTION = "CN+S"
"""Light time (converged Newtonian) plus stellar aberration: apparent geometry (D2)."""

SUPPORTED_CORRECTIONS = frozenset({"CN+S", "LT+S", "CN", "LT", "NONE"})


class GeometryError(ValueError):
    """Raised when geometry cannot be computed for the given inputs."""


class Body(StrEnum):
    """Bodies whose geometry LUNARIS computes (SPICE body names)."""

    SUN = "SUN"
    EARTH = "EARTH"


@dataclass(frozen=True, slots=True)
class ObserverSite:
    """Eye point on the lunar surface.

    ``coordinate.height_m`` is the DEM surface height above the reference sphere, or
    ``None`` when it has not been sampled; in that case the surface is assumed to lie on
    the sphere (h = 0), and the assumption is reported. ``observer_height_m`` is the eye
    height above the surface.
    """

    coordinate: SelenographicCoordinate
    observer_height_m: float = 0.0
    reference_radius_m: float = LOLA_REFERENCE_SPHERE_RADIUS.value

    def __post_init__(self) -> None:
        if self.coordinate.frame is not CANONICAL_FRAME:
            raise CoordinateError(f"site must be in {CANONICAL_FRAME}, got {self.coordinate.frame}")
        if abs(self.coordinate.latitude_deg) == LATITUDE_LIMIT_DEG:
            raise CoordinateError(
                "local north and east are undefined at latitude ±90°; "
                "use a latitude strictly inside (−90, 90)"
            )
        height = float(self.observer_height_m)
        if not math.isfinite(height) or height < 0.0:
            raise CoordinateError(f"observer_height_m must be finite and ≥ 0, got {height}")
        object.__setattr__(self, "observer_height_m", height)

    @property
    def surface_height_known(self) -> bool:
        return self.coordinate.height_m is not None

    @property
    def radius_m(self) -> float:
        surface = self.coordinate.height_m if self.coordinate.height_m is not None else 0.0
        return self.reference_radius_m + surface + self.observer_height_m

    @property
    def position_moon_me_m(self) -> FloatArray:
        return spherical_to_cartesian(
            self.coordinate.latitude_deg, self.coordinate.longitude_deg, self.radius_m
        )

    @property
    def assumptions(self) -> tuple[str, ...]:
        statements = []
        if not self.surface_height_known:
            statements.append(
                "Surface height not sampled: the site is placed on the "
                f"{self.reference_radius_m:.0f} m reference sphere (h = 0 m)."
            )
        statements.append(f"Observer eye height {self.observer_height_m:g} m above the surface.")
        return tuple(statements)


def enu_basis(position_m: ArrayLike) -> FloatArray:
    """Rows east, north, up of the local frame at ``position_m`` (C0 convention).

    Up is the reference-sphere radial direction, not the terrain normal.

    Raises:
        CoordinateError: on the polar axis, where east and north are undefined.
    """
    s = np.asarray(position_m, dtype=np.float64)
    norm = float(np.linalg.norm(s))
    if not math.isfinite(norm) or norm == 0.0:
        raise CoordinateError("position must be finite and non-zero")
    up = s / norm
    east = np.cross(np.array([0.0, 0.0, 1.0]), up)
    east_norm = float(np.linalg.norm(east))
    if east_norm < POLAR_AXIS_EPSILON:
        raise CoordinateError("local east is undefined on the polar axis")
    east /= east_norm
    north = np.cross(up, east)
    return np.stack([east, north, up])


def topocentric_az_el(
    vectors_m: ArrayLike, basis: FloatArray
) -> tuple[FloatArray, FloatArray, FloatArray]:
    """Azimuth (clockwise from north, [0, 360)), elevation (deg) and range (m) of
    observer-relative vectors of shape ``(N, 3)`` expressed in the body-fixed frame."""
    v = np.asarray(vectors_m, dtype=np.float64)
    enu = v @ basis.T
    range_m = np.linalg.norm(v, axis=-1)
    azimuth = np.mod(np.degrees(np.arctan2(enu[..., 0], enu[..., 1])), FULL_TURN_DEG)
    azimuth = np.where(azimuth >= FULL_TURN_DEG, 0.0, azimuth)
    elevation = np.degrees(np.arcsin(np.clip(enu[..., 2] / range_m, -1.0, 1.0)))
    return azimuth, elevation, range_m


@dataclass(frozen=True, slots=True)
class BodyGeometrySeries:
    """Apparent topocentric geometry of one body at a series of epochs (C2)."""

    body: Body
    epochs_et_s: FloatArray
    azimuth_deg: FloatArray
    elevation_deg: FloatArray
    range_m: FloatArray
    angular_radius_deg: FloatArray
    direction_moon_me: FloatArray
    """Apparent unit direction, shape (N, 3), in ``MOON_ME``."""
    body_radius_m: float
    """Radius used for ``angular_radius_deg`` (Earth: equatorial radius from the PCK)."""
    body_radii_m: tuple[float, float, float]
    observer: ObserverSite
    aberration_correction: str
    evidence: Evidence
    frame: str = field(default=CANONICAL_FRAME_NAME)

    def __post_init__(self) -> None:
        n = self.epochs_et_s.shape[0]
        for name in ("azimuth_deg", "elevation_deg", "range_m", "angular_radius_deg"):
            if getattr(self, name).shape != (n,):
                raise GeometryError(f"{name} must have shape ({n},)")
        if self.direction_moon_me.shape != (n, 3):
            raise GeometryError(f"direction_moon_me must have shape ({n}, 3)")

    def __len__(self) -> int:
        return int(self.epochs_et_s.shape[0])


def body_geometry(
    context: SpiceContext,
    body: Body,
    observer: ObserverSite,
    epochs_et_s: ArrayLike,
    *,
    aberration_correction: str = APPARENT_CORRECTION,
) -> BodyGeometrySeries:
    """Apparent azimuth, elevation, range, angular radius and direction of ``body``.

    Args:
        context: loaded SPICE context; every SPICE call holds its lock.
        body: target body.
        observer: surface eye point (MOON_ME).
        epochs_et_s: ET seconds past J2000 (TDB), shape (N,).
        aberration_correction: SPICE correction string, recorded in the evidence.

    Raises:
        GeometryError: for epochs outside the kernel coverage, unsupported corrections or
            a SPICE failure.
    """
    body = Body(body)
    if aberration_correction not in SUPPORTED_CORRECTIONS:
        raise GeometryError(f"unsupported aberration correction {aberration_correction!r}")
    ets = np.atleast_1d(np.asarray(epochs_et_s, dtype=np.float64))
    if ets.ndim != 1:
        raise GeometryError("epochs_et_s must be one-dimensional")
    if not np.all(np.isfinite(ets)):
        raise GeometryError("epochs must be finite")
    coverage = context.coverage
    if ets.size and (
        float(np.min(ets)) < coverage.start_et_s or float(np.max(ets)) > coverage.end_et_s
    ):
        raise GeometryError("epochs fall outside the time coverage of the loaded kernels")

    site_m = observer.position_moon_me_m
    site_km = site_m / KM
    relative_km = np.empty((ets.size, 3), dtype=np.float64)
    try:
        with context.session():
            radii_km = np.asarray(spiceypy.bodvrd(body.value, "RADII", 3)[1], dtype=np.float64)
            for i, et in enumerate(ets):
                state, _ = spiceypy.spkcpo(
                    body.value,
                    float(et),
                    CANONICAL_FRAME_NAME,
                    "OBSERVER",
                    aberration_correction,
                    site_km,
                    "MOON",
                    CANONICAL_FRAME_NAME,
                )
                relative_km[i] = state[:3]
    except SpiceyError as exc:
        raise GeometryError(f"SPICE could not compute {body.value} geometry: {exc.short}") from exc

    relative_m = relative_km * KM
    azimuth, elevation, range_m = topocentric_az_el(relative_m, enu_basis(site_m))
    radii_m = radii_km * KM
    body_radius_m = float(radii_m[0])
    angular_radius = np.degrees(np.arcsin(np.clip(body_radius_m / range_m, -1.0, 1.0)))
    direction = relative_m / range_m[:, None]
    if not (np.all(np.isfinite(azimuth)) and np.all(np.isfinite(elevation))):
        raise GeometryError("non-finite geometry result")

    return BodyGeometrySeries(
        body=body,
        epochs_et_s=ets,
        azimuth_deg=azimuth,
        elevation_deg=elevation,
        range_m=range_m,
        angular_radius_deg=angular_radius,
        direction_moon_me=direction,
        body_radius_m=body_radius_m,
        body_radii_m=(float(radii_m[0]), float(radii_m[1]), float(radii_m[2])),
        observer=observer,
        aberration_correction=aberration_correction,
        evidence=_evidence(context, body, observer, aberration_correction, radii_m),
    )


def _evidence(
    context: SpiceContext,
    body: Body,
    observer: ObserverSite,
    aberration_correction: str,
    radii_m: FloatArray,
) -> Evidence:
    name = body.value.capitalize()
    assumptions = list(observer.assumptions)
    # A radius read from a NASA kernel is data, not an assumption, so it goes in the method.
    if body is Body.EARTH:
        radius_note = (
            f"Earth angular radius uses the equatorial radius {radii_m[0] / KM:.4f} km from the "
            f"loaded PCK (polar radius {radii_m[2] / KM:.4f} km; the difference is ≤ 0.34% "
            "of the angular radius)."
        )
    else:
        radius_note = f"Solar radius {radii_m[0] / KM:.1f} km from the loaded PCK."
    assumptions.append(
        "Gravitational light deflection is not modelled (JPL Horizons includes it); "
        "measured agreement with Horizons is within 0.002 arcsec."
    )
    return Evidence(
        kind=EvidenceKind.MODEL,
        statement=(
            f"Apparent topocentric direction, range and angular radius of the {name} from the "
            f"site, computed from the JPL DE440 ephemeris through NAIF SPICE "
            f"(corrections {aberration_correction})."
        ),
        sources=context.kernel_set.sources,
        method=(
            f"CSPICE spkcpo('{body.value}', et, 'MOON_ME', 'OBSERVER', "
            f"'{aberration_correction}', site, 'MOON', 'MOON_ME'); local ENU basis from the "
            "reference-sphere radial direction (C0); azimuth = atan2(E, N) mod 360° clockwise "
            "from north; elevation = asin(U/|r|); angular radius = asin(R_body/|r|). "
            f"MOON_ME resolves to {context.frame_resolution.resolves_to}. {radius_note}"
        ),
        assumptions=tuple(assumptions),
    )


@dataclass(frozen=True, slots=True)
class MoonCentredSeries:
    """Apparent direction of a body from the Moon's centre (T-26).

    Used to light the whole globe: the direction is the same for every surface point to
    within the Moon's radius over the body's distance (Sun: 1.2e-5 rad, ≈ 2.4″).
    """

    body: Body
    epochs_et_s: FloatArray
    direction_moon_me: FloatArray
    """Apparent unit direction, shape (N, 3), in ``MOON_ME``."""
    range_m: FloatArray
    angular_radius_deg: FloatArray
    subpoint_latitude_deg: FloatArray
    """Planetocentric latitude where the body is at the zenith (the direction itself)."""
    subpoint_longitude_deg: FloatArray
    """East longitude in [0, 360)."""
    body_radius_m: float
    aberration_correction: str
    evidence: Evidence

    def __len__(self) -> int:
        return int(self.epochs_et_s.shape[0])


def moon_centred_direction(
    context: SpiceContext,
    body: Body,
    epochs_et_s: ArrayLike,
    *,
    aberration_correction: str = APPARENT_CORRECTION,
) -> MoonCentredSeries:
    """Apparent direction, range, angular radius and sub-body point of ``body`` seen from
    the Moon's centre, in ``MOON_ME``.

    CSPICE ``spkpos(body, et, 'MOON_ME', 'CN+S', 'MOON')``; the sub-body point is the
    planetocentric latitude/longitude of that direction, which on the 1737.4 km sphere is
    both the "near point" and the "intercept" sub-body point.

    Raises:
        GeometryError: for epochs outside the kernel coverage, unsupported corrections or
            a SPICE failure.
    """
    body = Body(body)
    if aberration_correction not in SUPPORTED_CORRECTIONS:
        raise GeometryError(f"unsupported aberration correction {aberration_correction!r}")
    ets = np.atleast_1d(np.asarray(epochs_et_s, dtype=np.float64))
    if ets.ndim != 1 or not np.all(np.isfinite(ets)):
        raise GeometryError("epochs_et_s must be one-dimensional and finite")
    coverage = context.coverage
    if ets.size and (
        float(np.min(ets)) < coverage.start_et_s or float(np.max(ets)) > coverage.end_et_s
    ):
        raise GeometryError("epochs fall outside the time coverage of the loaded kernels")
    positions_km = np.empty((ets.size, 3), dtype=np.float64)
    try:
        with context.session():
            radii_km = np.asarray(spiceypy.bodvrd(body.value, "RADII", 3)[1], dtype=np.float64)
            for i, et in enumerate(ets):
                position, _ = spiceypy.spkpos(
                    body.value, float(et), CANONICAL_FRAME_NAME, aberration_correction, "MOON"
                )
                positions_km[i] = position
    except SpiceyError as exc:
        raise GeometryError(f"SPICE could not compute {body.value} position: {exc.short}") from exc
    positions_m = positions_km * KM
    range_m = np.linalg.norm(positions_m, axis=1)
    direction = positions_m / range_m[:, None]
    latitude, longitude, _ = cartesian_to_spherical(direction)
    body_radius_m = float(radii_km[0] * KM)
    angular_radius = np.degrees(np.arcsin(np.clip(body_radius_m / range_m, -1.0, 1.0)))
    name = body.value.capitalize()
    evidence = Evidence(
        kind=EvidenceKind.MODEL,
        statement=(
            f"Apparent direction of the {name} from the Moon's centre, its range, angular "
            f"radius and sub-{name.lower()} point, from the JPL DE440 ephemeris through NAIF "
            f"SPICE (corrections {aberration_correction})."
        ),
        sources=context.kernel_set.sources,
        method=(
            f"CSPICE spkpos('{body.value}', et, 'MOON_ME', '{aberration_correction}', 'MOON'); "
            "unit vector; sub-point = planetocentric latitude/east longitude of the direction "
            "(the 1737.4 km sphere); angular radius = asin(R_body/|r|). MOON_ME resolves to "
            f"{context.frame_resolution.resolves_to}."
        ),
        assumptions=(
            "Moon-centred: from a surface point the direction differs by up to "
            "R_moon/range (≈ 2.4 arcsec for the Sun, ≈ 0.26° for the Earth); use the site "
            "ephemeris for topocentric values.",
            f"{name} radius {body_radius_m / KM:.4f} km from the loaded PCK.",
        ),
    )
    return MoonCentredSeries(
        body=body,
        epochs_et_s=ets,
        direction_moon_me=direction,
        range_m=range_m,
        angular_radius_deg=angular_radius,
        subpoint_latitude_deg=latitude,
        subpoint_longitude_deg=longitude,
        body_radius_m=body_radius_m,
        aberration_correction=aberration_correction,
        evidence=evidence,
    )


__all__ = [
    "APPARENT_CORRECTION",
    "Body",
    "BodyGeometrySeries",
    "GeometryError",
    "MoonCentredSeries",
    "ObserverSite",
    "body_geometry",
    "enu_basis",
    "moon_centred_direction",
    "topocentric_az_el",
]
