"""Terrain horizon mask: horizon elevation angle as a function of azimuth (contract C1).

A :class:`HorizonMask` records, for one site, the elevation angle of the terrain horizon
seen from an eye point above the DEM surface, sampled at a uniform azimuth step around
the full circle. It is produced by the terrain module (S-TERRAIN, task T-15) and consumed
by the illumination and visibility modules (S-GEOMETRY), which compare a body's apparent
elevation against it (``docs/DECISIONS.md`` D4).

Conventions (``docs/TASKS.md`` C0):

* Frame: ``MOON_ME``; the site is planetocentric.
* The local horizontal plane is normal to the **reference-sphere radial direction** at
  the site (sphere radius 1 737 400 m), never to the terrain surface normal.
* Azimuth: degrees clockwise from local north, in [0, 360).
* Elevation: degrees above that plane, positive up.
* The local frame is undefined at latitude exactly ±90°, so a mask cannot be built there.

Truncation: where a ray left DEM coverage before ``max_range_m``, ``truncated`` is
``True`` and ``elevation_deg`` there is only a **lower bound** (terrain beyond the DEM
edge could raise the horizon). Downstream results must surface truncation; it is never
silently treated as exact (D3).

Consumers interpolate ``elevation_deg`` linearly and periodically in azimuth, as
:meth:`HorizonMask.elevation_at` does.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import ArrayLike, NDArray

from lunaris_science.coordinates import (
    FULL_TURN_DEG,
    LATITUDE_LIMIT_DEG,
    CoordinateError,
    SelenographicCoordinate,
)
from lunaris_science.frames import CANONICAL_FRAME
from lunaris_science.provenance import SHA256_HEX_LENGTH

MIN_AZIMUTH_SAMPLES = 360
"""Smallest number of azimuth samples a mask may have (a 1° step)."""

AZIMUTH_STEP_TOLERANCE_DEG = 1e-9
"""Tolerance on the uniformity of the azimuth step and on full-circle coverage."""

_HEX_DIGITS = frozenset("0123456789abcdef")


class HorizonMaskError(ValueError):
    """Raised when a horizon mask violates contract C1."""


def _readonly(array: NDArray[np.generic]) -> NDArray[np.generic]:
    array.setflags(write=False)
    return array


@dataclass(frozen=True, slots=True)
class HorizonMask:
    """Horizon elevation angle versus azimuth for one site (contract C1).

    Attributes:
        site: the site, ``MOON_ME``, planetocentric. Latitude must be strictly inside
            (−90°, 90°).
        observer_height_m: height of the eye point above the DEM surface at the site, m.
        surface_height_m: DEM height at the site above the 1 737 400 m sphere, m.
        azimuth_deg: shape ``(N,)``, uniform step, starts at 0.0 and covers the full
            circle (``N × step = 360°``), C0 convention.
        elevation_deg: shape ``(N,)``, horizon elevation angle above the C0 plane, deg.
        truncated: shape ``(N,)``; ``True`` where the ray left DEM coverage before
            ``max_range_m``, in which case ``elevation_deg`` there is a lower bound.
        max_range_m: the ray-march range, m (ground distance on the sphere).
        dem_source_id: dataset manifest id of the DEM.
        dem_sha256: SHA-256 of the DEM file the mask came from (lower-case hex).
        dem_resolution_m: nominal DEM grid spacing, m.
        method: description of the computation (for example
            ``"ray-march, curvature-corrected, ..."``).

    The arrays are copied and made read-only on construction.
    """

    site: SelenographicCoordinate
    observer_height_m: float
    surface_height_m: float
    azimuth_deg: NDArray[np.float64]
    elevation_deg: NDArray[np.float64]
    truncated: NDArray[np.bool_]
    max_range_m: float
    dem_source_id: str
    dem_sha256: str
    dem_resolution_m: float
    method: str

    def __post_init__(self) -> None:
        self._validate_site()
        self._validate_scalars()
        self._validate_arrays()
        self._validate_text()

    def _validate_site(self) -> None:
        if not isinstance(self.site, SelenographicCoordinate):
            raise HorizonMaskError("site must be a SelenographicCoordinate")
        if self.site.frame is not CANONICAL_FRAME:
            raise HorizonMaskError(f"site must be in {CANONICAL_FRAME.value}")
        if abs(self.site.latitude_deg) == LATITUDE_LIMIT_DEG:
            raise CoordinateError(
                "the local horizontal frame is undefined at latitude ±90°; "
                "a horizon mask needs a site strictly inside (−90°, 90°)"
            )

    def _validate_scalars(self) -> None:
        for name in ("observer_height_m", "surface_height_m", "max_range_m", "dem_resolution_m"):
            value = float(getattr(self, name))
            if not math.isfinite(value):
                raise HorizonMaskError(f"{name} must be finite, got {value!r}")
            object.__setattr__(self, name, value)
        if self.observer_height_m < 0.0:
            raise HorizonMaskError("observer_height_m must be non-negative")
        if self.max_range_m <= 0.0:
            raise HorizonMaskError("max_range_m must be positive")
        if self.dem_resolution_m <= 0.0:
            raise HorizonMaskError("dem_resolution_m must be positive")

    def _validate_arrays(self) -> None:
        azimuth = np.array(self.azimuth_deg, dtype=np.float64, copy=True)
        elevation = np.array(self.elevation_deg, dtype=np.float64, copy=True)
        truncated_in = np.asarray(self.truncated)
        if truncated_in.dtype != np.bool_:
            raise HorizonMaskError("truncated must be a boolean array")
        truncated = np.array(truncated_in, dtype=np.bool_, copy=True)

        for name, array in (
            ("azimuth_deg", azimuth),
            ("elevation_deg", elevation),
            ("truncated", truncated),
        ):
            if array.ndim != 1:
                raise HorizonMaskError(f"{name} must be one-dimensional, got shape {array.shape}")
        n = azimuth.shape[0]
        if elevation.shape[0] != n or truncated.shape[0] != n:
            raise HorizonMaskError(
                "azimuth_deg, elevation_deg and truncated must have equal lengths, got "
                f"{n}, {elevation.shape[0]}, {truncated.shape[0]}"
            )
        if n < MIN_AZIMUTH_SAMPLES:
            raise HorizonMaskError(f"a mask needs at least {MIN_AZIMUTH_SAMPLES} samples, got {n}")
        if not (np.all(np.isfinite(azimuth)) and np.all(np.isfinite(elevation))):
            raise HorizonMaskError("azimuth_deg and elevation_deg must be finite")
        if azimuth[0] != 0.0:
            raise HorizonMaskError(f"azimuth_deg must start at 0.0, got {azimuth[0]}")

        step = FULL_TURN_DEG / n
        expected = np.arange(n, dtype=np.float64) * step
        if np.max(np.abs(azimuth - expected)) > AZIMUTH_STEP_TOLERANCE_DEG:
            raise HorizonMaskError(
                "azimuth_deg must have a uniform step covering [0, 360) exactly "
                f"(expected step {step}° for N = {n})"
            )
        if np.any(np.abs(elevation) > LATITUDE_LIMIT_DEG):
            raise HorizonMaskError("elevation_deg values must be within [-90, 90]")

        object.__setattr__(self, "azimuth_deg", _readonly(azimuth))
        object.__setattr__(self, "elevation_deg", _readonly(elevation))
        object.__setattr__(self, "truncated", _readonly(truncated))

    def _validate_text(self) -> None:
        if not self.dem_source_id.strip():
            raise HorizonMaskError("dem_source_id must not be empty")
        if not self.method.strip():
            raise HorizonMaskError("method must not be empty")
        digest = self.dem_sha256
        if len(digest) != SHA256_HEX_LENGTH or not set(digest) <= _HEX_DIGITS:
            raise HorizonMaskError("dem_sha256 must be 64 lower-case hexadecimal characters")

    @property
    def size(self) -> int:
        """Number of azimuth samples ``N``."""
        return int(self.azimuth_deg.shape[0])

    @property
    def step_deg(self) -> float:
        """Uniform azimuth step, degrees (``360 / N``)."""
        return FULL_TURN_DEG / self.size

    @property
    def any_truncated(self) -> bool:
        """Whether any azimuth sample is a lower bound only."""
        return bool(np.any(self.truncated))

    def _bracket(
        self, azimuth_deg: ArrayLike
    ) -> tuple[NDArray[np.intp], NDArray[np.intp], NDArray[np.float64]]:
        az = np.asarray(azimuth_deg, dtype=np.float64)
        if not np.all(np.isfinite(az)):
            raise HorizonMaskError("azimuth values must be finite")
        position = np.mod(az, FULL_TURN_DEG) / self.step_deg
        lower = np.floor(position)
        weight = position - lower
        i0 = lower.astype(np.intp) % self.size
        i1 = (i0 + 1) % self.size
        return i0, i1, weight

    def elevation_at(self, azimuth_deg: ArrayLike) -> NDArray[np.float64]:
        """Horizon elevation (deg) at arbitrary azimuths (deg), linear and periodic.

        Azimuths may be any finite value; they are wrapped into [0, 360).
        """
        i0, i1, weight = self._bracket(azimuth_deg)
        e = self.elevation_deg
        result: NDArray[np.float64] = (1.0 - weight) * e[i0] + weight * e[i1]
        return result

    def truncated_at(self, azimuth_deg: ArrayLike) -> NDArray[np.bool_]:
        """Whether the interpolated horizon at each azimuth depends on a truncated sample."""
        i0, i1, weight = self._bracket(azimuth_deg)
        t = self.truncated
        uses_upper = weight > 0.0
        result: NDArray[np.bool_] = t[i0] | (uses_upper & t[i1])
        return result


__all__ = [
    "AZIMUTH_STEP_TOLERANCE_DEG",
    "MIN_AZIMUTH_SAMPLES",
    "HorizonMask",
    "HorizonMaskError",
]
