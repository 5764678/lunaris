"""Selenographic coordinate primitives.

Conventions (authoritative description: ``docs/SCIENCE.md`` § Coordinate conventions):

* **Latitude** — planetocentric, degrees, closed interval [-90, +90], positive north.
* **Longitude** — east-positive, degrees, canonical half-open interval [0, 360).
  Inputs in (-180, 180] are accepted and normalized.
* **Height** — metres above an explicitly stated reference sphere. LUNARIS never uses
  "altitude" or "elevation" for surface positions without naming the reference.
* **Cartesian** — body-fixed, metres, right-handed, in a named frame
  (canonically ``MOON_ME``): +X toward 0° N 0° E, +Y toward 0° N 90° E, +Z north.

Everything here is definitional geometry on a sphere. Nothing in this module
samples terrain or uses observational data.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import ArrayLike, NDArray

from lunaris_science.frames import CANONICAL_FRAME, LunarFrame

FloatArray = NDArray[np.float64]

LATITUDE_LIMIT_DEG = 90.0
"""Absolute bound of planetocentric latitude."""
FULL_TURN_DEG = 360.0
HALF_TURN_DEG = 180.0


class CoordinateError(ValueError):
    """Raised when a coordinate is outside its domain or not finite."""


def validate_latitude_deg(latitude_deg: float) -> float:
    """Return ``latitude_deg`` as ``float`` if it is finite and within [-90, 90].

    Raises:
        CoordinateError: if the value is not finite or outside the closed interval.
    """
    value = float(latitude_deg)
    if not math.isfinite(value):
        raise CoordinateError(f"latitude must be finite, got {latitude_deg!r}")
    if not -LATITUDE_LIMIT_DEG <= value <= LATITUDE_LIMIT_DEG:
        raise CoordinateError(f"latitude must be within [-90, 90] degrees, got {value}")
    return value


def normalize_east_longitude_deg(longitude_deg: float) -> float:
    """Normalize an east-positive longitude to the canonical interval [0, 360) degrees.

    ``-0.0`` and values that round to exactly 360.0 map to ``0.0``.

    Raises:
        CoordinateError: if the value is not finite.
    """
    value = float(longitude_deg)
    if not math.isfinite(value):
        raise CoordinateError(f"longitude must be finite, got {longitude_deg!r}")
    normalized = math.fmod(value, FULL_TURN_DEG)
    if normalized < 0.0:
        normalized += FULL_TURN_DEG
    # fmod/addition can yield exactly 360.0 for tiny negative inputs; also fold -0.0.
    if normalized >= FULL_TURN_DEG or normalized == 0.0:
        normalized = 0.0
    return normalized


def to_signed_longitude_deg(longitude_deg: float) -> float:
    """Convert an east longitude to the signed interval (-180, 180] degrees."""
    normalized = normalize_east_longitude_deg(longitude_deg)
    return normalized - FULL_TURN_DEG if normalized > HALF_TURN_DEG else normalized


@dataclass(frozen=True, slots=True)
class SelenographicCoordinate:
    """A validated planetocentric surface coordinate.

    ``height_m`` is the height above the stated reference sphere, or ``None`` when it
    has not been sampled. ``None`` is deliberately distinct from ``0.0``: callers that
    need a height must state their assumption explicitly.
    """

    latitude_deg: float
    longitude_deg: float
    height_m: float | None = None
    frame: LunarFrame = CANONICAL_FRAME

    def __post_init__(self) -> None:
        object.__setattr__(self, "latitude_deg", validate_latitude_deg(self.latitude_deg))
        object.__setattr__(self, "longitude_deg", normalize_east_longitude_deg(self.longitude_deg))
        if self.height_m is not None:
            height = float(self.height_m)
            if not math.isfinite(height):
                raise CoordinateError(f"height must be finite, got {self.height_m!r}")
            object.__setattr__(self, "height_m", height)
        object.__setattr__(self, "frame", LunarFrame(self.frame))


def spherical_to_cartesian(
    latitude_deg: ArrayLike,
    longitude_deg: ArrayLike,
    radius_m: ArrayLike,
) -> FloatArray:
    """Convert planetocentric spherical coordinates to body-fixed Cartesian metres.

    Inputs broadcast against each other. The result has shape ``broadcast + (3,)`` with
    components ``(x, y, z)`` in metres, in the same body-fixed frame as the inputs.

    Raises:
        CoordinateError: on non-finite inputs, latitudes outside [-90, 90] or negative
            radii.
    """
    lat = np.asarray(latitude_deg, dtype=np.float64)
    lon = np.asarray(longitude_deg, dtype=np.float64)
    radius = np.asarray(radius_m, dtype=np.float64)
    for name, array in (("latitude", lat), ("longitude", lon), ("radius", radius)):
        if not np.all(np.isfinite(array)):
            raise CoordinateError(f"{name} values must be finite")
    if np.any(np.abs(lat) > LATITUDE_LIMIT_DEG):
        raise CoordinateError("latitude values must be within [-90, 90] degrees")
    if np.any(radius < 0.0):
        raise CoordinateError("radius values must be non-negative")

    lat_rad = np.deg2rad(lat)
    lon_rad = np.deg2rad(lon)
    cos_lat = np.cos(lat_rad)
    return np.stack(
        np.broadcast_arrays(
            radius * cos_lat * np.cos(lon_rad),
            radius * cos_lat * np.sin(lon_rad),
            radius * np.sin(lat_rad),
        ),
        axis=-1,
    )


def cartesian_to_spherical(xyz_m: ArrayLike) -> tuple[FloatArray, FloatArray, FloatArray]:
    """Convert body-fixed Cartesian metres to planetocentric spherical coordinates.

    Args:
        xyz_m: array of shape ``(..., 3)``.

    Returns:
        ``(latitude_deg, longitude_deg, radius_m)``; longitude is east-positive in
        [0, 360). Latitude uses ``atan2(z, hypot(x, y))``, which stays well conditioned
        near the poles (unlike ``asin(z / r)``).

    Raises:
        CoordinateError: on non-finite input, wrong shape, or the origin (undefined
            direction).
    """
    xyz = np.asarray(xyz_m, dtype=np.float64)
    if xyz.shape[-1:] != (3,):
        raise CoordinateError(f"expected an array of shape (..., 3), got {xyz.shape}")
    if not np.all(np.isfinite(xyz)):
        raise CoordinateError("Cartesian components must be finite")
    x, y, z = xyz[..., 0], xyz[..., 1], xyz[..., 2]
    horizontal = np.hypot(x, y)
    radius = np.hypot(horizontal, z)
    if np.any(radius == 0.0):
        raise CoordinateError("direction is undefined at the origin")
    latitude = np.rad2deg(np.arctan2(z, horizontal))
    longitude = np.mod(np.rad2deg(np.arctan2(y, x)), FULL_TURN_DEG)
    # np.mod can return exactly 360.0 for tiny negative angles; fold to 0.0.
    longitude = np.where(longitude >= FULL_TURN_DEG, 0.0, longitude)
    return latitude, longitude, radius


__all__ = [
    "FULL_TURN_DEG",
    "HALF_TURN_DEG",
    "LATITUDE_LIMIT_DEG",
    "CoordinateError",
    "SelenographicCoordinate",
    "cartesian_to_spherical",
    "normalize_east_longitude_deg",
    "spherical_to_cartesian",
    "to_signed_longitude_deg",
    "validate_latitude_deg",
]
