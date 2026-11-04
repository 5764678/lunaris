"""South polar stereographic projection on a sphere, and the pixel grid of polar LOLA DEMs.

Projection (Snyder 1987, polar aspect, spherical form), centred on the south pole with
central meridian 0° E. For planetocentric latitude φ and east longitude λ:

    ρ = 2R · tan(45° + φ/2)
    x = ρ · sin λ        (map east-ish axis: toward 90° E)
    y = ρ · cos λ        (map "up" axis: toward 0° E, the mean Earth direction)

with inverse φ = 2·atan(ρ / 2R) − 90°, λ = atan2(x, y) mod 360°. The point scale factor
is k(φ) = 2 / (1 − sin φ) = 2 / (1 + sin|φ|) in the southern hemisphere: 1 at the pole,
≈ 1.0173 at 75° S. A distance measured on the map near latitude φ corresponds to a
ground distance on the sphere of (map distance) / k(φ).

Axis orientation. This is the orientation stated in the LOLA GDR projection description
``DSMAP_POLAR.CAT`` ("In the south, Longitude 0 extends straight up from the center, and
Longitude 90 East extends to the right"; inverse equations ``X = (I − N/2 − 0.5)·S``,
``Y = −(J − N/2 − 0.5)·S``, ``LON = ATAN2(X, Y)``) and by PROJ's ``+proj=stere
+lat_0=-90 +lon_0=0``, which the PGDA GeoTIFFs use. In body-fixed ``MOON_ME`` terms the
map ``x`` axis is parallel to +Y_ME and the map ``y`` axis to +X_ME, i.e. the map is the
south pole seen from outside the Moon (not mirrored).

Note: the same ``DSMAP_POLAR.CAT`` (2022 revision) also gives a forward transformation
that multiplies R by SIGN(LAT), which for the south would mirror the sample axis and
contradicts both its own inverse and its prose. LUNARIS follows the prose and inverse;
the orientation is pinned by tests against real DEM samples (``docs/SCIENCE.md`` §5.1).

Pixel grid. For a polar LOLA image with ``SAMPLE_PROJECTION_OFFSET`` s₀,
``LINE_PROJECTION_OFFSET`` l₀ and ``MAP_SCALE`` S (m/px), the centre of the pixel with
**0-based** indices (line, sample) is at

    x = (sample − s₀) · S
    y = −(line − l₀) · S

so lines increase toward −y (downward on the map). For LDEM_75S_240M (3812 × 3812,
s₀ = l₀ = 1905.5, S = 240 m) the pole lies exactly at the centre of the grid, between
pixels 1905 and 1906.

Pure geometry; no I/O.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import ArrayLike, NDArray

from lunaris_science.constants import LOLA_REFERENCE_SPHERE_RADIUS
from lunaris_science.coordinates import (
    FULL_TURN_DEG,
    LATITUDE_LIMIT_DEG,
    CoordinateError,
)

FloatArray = NDArray[np.float64]

_HALF_PIXEL = 0.5


def _finite(name: str, value: ArrayLike) -> FloatArray:
    array = np.asarray(value, dtype=np.float64)
    if not np.all(np.isfinite(array)):
        raise CoordinateError(f"{name} values must be finite")
    return array


@dataclass(frozen=True, slots=True)
class SouthPolarStereographic:
    """South polar stereographic projection on a sphere of radius ``radius_m``.

    Map coordinates ``(x, y)`` are metres in the projection plane, true scale at the
    pole. Valid for every latitude except the north pole (+90°), where ρ is infinite.
    """

    radius_m: float = LOLA_REFERENCE_SPHERE_RADIUS.value

    def __post_init__(self) -> None:
        radius = float(self.radius_m)
        if not math.isfinite(radius) or radius <= 0.0:
            raise CoordinateError(f"radius must be positive and finite, got {self.radius_m!r}")
        object.__setattr__(self, "radius_m", radius)

    def radial_distance_m(self, latitude_deg: ArrayLike) -> FloatArray:
        """Distance ρ (m) from the pole in the projection plane: 2R·tan(45° + φ/2)."""
        lat = _finite("latitude", latitude_deg)
        if np.any(lat < -LATITUDE_LIMIT_DEG) or np.any(lat >= LATITUDE_LIMIT_DEG):
            raise CoordinateError("latitude must be within [-90, 90) degrees for this projection")
        result: FloatArray = 2.0 * self.radius_m * np.tan(np.deg2rad(45.0 + 0.5 * lat))
        return result

    def forward(
        self, latitude_deg: ArrayLike, longitude_deg: ArrayLike
    ) -> tuple[FloatArray, FloatArray]:
        """Project planetocentric (φ, λ) in degrees to map ``(x, y)`` in metres."""
        rho = self.radial_distance_m(latitude_deg)
        lon_rad = np.deg2rad(_finite("longitude", longitude_deg))
        x, y = np.broadcast_arrays(rho * np.sin(lon_rad), rho * np.cos(lon_rad))
        return np.array(x, dtype=np.float64), np.array(y, dtype=np.float64)

    def inverse(self, x_m: ArrayLike, y_m: ArrayLike) -> tuple[FloatArray, FloatArray]:
        """Map ``(x, y)`` in metres to planetocentric (φ, λ) in degrees.

        Longitude is east-positive in [0, 360). At the pole itself (ρ = 0) longitude is
        undefined and returned as 0.0.
        """
        x = _finite("x", x_m)
        y = _finite("y", y_m)
        rho = np.hypot(x, y)
        latitude: FloatArray = np.rad2deg(2.0 * np.arctan(rho / (2.0 * self.radius_m))) - 90.0
        longitude = np.mod(np.rad2deg(np.arctan2(x, y)), FULL_TURN_DEG)
        longitude = np.where(longitude >= FULL_TURN_DEG, 0.0, longitude)
        return latitude, longitude

    def scale_factor(self, latitude_deg: ArrayLike) -> FloatArray:
        """Point scale factor k(φ) = 2 / (1 − sin φ) (dimensionless; 1 at the south pole)."""
        lat = _finite("latitude", latitude_deg)
        if np.any(lat < -LATITUDE_LIMIT_DEG) or np.any(lat >= LATITUDE_LIMIT_DEG):
            raise CoordinateError("latitude must be within [-90, 90) degrees for this projection")
        result: FloatArray = 2.0 / (1.0 - np.sin(np.deg2rad(lat)))
        return result

    def scale_factor_at_map(self, x_m: ArrayLike, y_m: ArrayLike) -> FloatArray:
        """Point scale factor at map coordinates: k = 1 + (ρ / 2R)²."""
        rho = np.hypot(_finite("x", x_m), _finite("y", y_m))
        result: FloatArray = 1.0 + (rho / (2.0 * self.radius_m)) ** 2
        return result


@dataclass(frozen=True, slots=True)
class PolarStereographicGrid:
    """Pixel grid of a south polar stereographic raster (PDS3 LOLA GDR convention).

    Pixel indices are 0-based and refer to pixel centres; ``line`` increases downward
    (toward −y), ``sample`` increases to the right (toward +x). See the module docstring.
    """

    lines: int
    samples: int
    line_projection_offset_px: float
    sample_projection_offset_px: float
    map_scale_m: float
    projection: SouthPolarStereographic = SouthPolarStereographic()

    def __post_init__(self) -> None:
        if self.lines <= 0 or self.samples <= 0:
            raise CoordinateError("grid dimensions must be positive")
        for name in ("line_projection_offset_px", "sample_projection_offset_px", "map_scale_m"):
            value = float(getattr(self, name))
            if not math.isfinite(value):
                raise CoordinateError(f"{name} must be finite")
            object.__setattr__(self, name, value)
        if self.map_scale_m <= 0.0:
            raise CoordinateError("map_scale_m must be positive")

    def map_to_pixel(self, x_m: ArrayLike, y_m: ArrayLike) -> tuple[FloatArray, FloatArray]:
        """Map metres → fractional 0-based ``(line, sample)`` pixel-centre coordinates."""
        x = _finite("x", x_m)
        y = _finite("y", y_m)
        line: FloatArray = self.line_projection_offset_px - y / self.map_scale_m
        sample: FloatArray = self.sample_projection_offset_px + x / self.map_scale_m
        return line, sample

    def pixel_to_map(self, line: ArrayLike, sample: ArrayLike) -> tuple[FloatArray, FloatArray]:
        """Fractional 0-based ``(line, sample)`` → map metres."""
        ln = _finite("line", line)
        sp = _finite("sample", sample)
        x: FloatArray = (sp - self.sample_projection_offset_px) * self.map_scale_m
        y: FloatArray = -(ln - self.line_projection_offset_px) * self.map_scale_m
        return x, y

    def latlon_to_pixel(
        self, latitude_deg: ArrayLike, longitude_deg: ArrayLike
    ) -> tuple[FloatArray, FloatArray]:
        """Planetocentric degrees → fractional 0-based ``(line, sample)``."""
        return self.map_to_pixel(*self.projection.forward(latitude_deg, longitude_deg))

    def pixel_to_latlon(self, line: ArrayLike, sample: ArrayLike) -> tuple[FloatArray, FloatArray]:
        """Fractional 0-based ``(line, sample)`` → planetocentric degrees (φ, λ)."""
        return self.projection.inverse(*self.pixel_to_map(line, sample))

    @property
    def extent_m(self) -> tuple[float, float, float, float]:
        """Outer pixel-edge bounds ``(x_min, x_max, y_min, y_max)`` in map metres."""
        x_min, y_max = self.pixel_to_map(-_HALF_PIXEL, -_HALF_PIXEL)
        x_max, y_min = self.pixel_to_map(self.lines - _HALF_PIXEL, self.samples - _HALF_PIXEL)
        return float(x_min), float(x_max), float(y_min), float(y_max)

    def contains_pixel(self, line: ArrayLike, sample: ArrayLike) -> NDArray[np.bool_]:
        """Whether fractional pixel coordinates fall inside the outer pixel edges."""
        ln = np.asarray(line, dtype=np.float64)
        sp = np.asarray(sample, dtype=np.float64)
        result: NDArray[np.bool_] = (
            (ln >= -_HALF_PIXEL)
            & (ln <= self.lines - _HALF_PIXEL)
            & (sp >= -_HALF_PIXEL)
            & (sp <= self.samples - _HALF_PIXEL)
        )
        return result


__all__ = ["PolarStereographicGrid", "SouthPolarStereographic"]
