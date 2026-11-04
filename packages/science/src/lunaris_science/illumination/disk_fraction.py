"""Visible fraction of a body's disk above a horizon (D4, T-23).

A body of angular radius *r* is centred at apparent azimuth *A* and elevation *e*
(contract C0). The horizon is a profile H(az): the terrain horizon from a
:class:`~lunaris_science.horizon_mask.HorizonMask` (C1), or the flat astronomical horizon
H ≡ 0°. The visible fraction is the share of the disk's area lying above H.

Method. The disk is described in the tangent plane at its centre, with x along
increasing azimuth (x = ΔA·cos e) and y along elevation. It is cut into vertical chords
at x = r·sin θ. The chord at x spans y ∈ [−h, h] with h = r·cos θ, and the part of it
above the horizon has length clamp(e + h − H(A + x / cos e), 0, 2h). Integrating over θ
with a midpoint rule (``nodes`` chords) gives::

    f = Σ visible(θ_m) · cos θ_m  /  Σ 2r · cos² θ_m

The denominator is the same rule applied to the full disk, so f is exactly 0 for a
fully hidden disk and exactly 1 for a fully visible one. H is sampled per chord, so a
horizon that slopes or steps within the disk's width is resolved, rather than assuming
it is straight across the disk. Mask elevations are interpolated linearly and
periodically in azimuth (C1).

Accuracy:

* Against the analytical circular segment of a straight horizon,
  f = 1 − (acos d − d·√(1 − d²)) / π with d = (e − H) / r, the error with the default
  128 nodes is ≤ 1.6e-5 (tested to 1e-3, the acceptance criterion).
* The tangent-plane description is a small-angle approximation: relative error of
  order r², about 3e-4 for the Earth (r ≈ 0.95°) and 2e-5 for the Sun.
* Limb darkening is neglected: f is a fraction of area, not of flux.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import ArrayLike, NDArray

FloatArray = NDArray[np.float64]
BoolArray = NDArray[np.bool_]

DEFAULT_NODES = 128
FULL_TURN_DEG = 360.0
MIN_MASK_SAMPLES = 360
"""C1: masks have at least 360 azimuth samples."""
STEP_RELATIVE_TOLERANCE = 1e-9
MAX_ABS_ELEVATION_DEG = 89.0
"""The tangent-plane azimuth scaling 1/cos e is not used near the zenith."""


class DiskFractionError(ValueError):
    """Raised for invalid horizon profiles or disk geometry."""


@dataclass(frozen=True, slots=True)
class HorizonProfile:
    """Horizon elevation as a function of azimuth, sampled on a uniform periodic grid.

    ``azimuth_deg`` starts at 0 with a uniform step and covers [0, 360) (C1).
    ``truncated`` marks azimuths whose elevation is only a lower bound because the ray
    left DEM coverage. A flat astronomical horizon has every elevation at 0 and nothing
    truncated (:meth:`astronomical`).
    """

    azimuth_deg: FloatArray
    elevation_deg: FloatArray
    truncated: BoolArray

    def __post_init__(self) -> None:
        az = np.asarray(self.azimuth_deg, dtype=np.float64)
        el = np.asarray(self.elevation_deg, dtype=np.float64)
        tr = np.asarray(self.truncated, dtype=np.bool_)
        if az.ndim != 1 or el.shape != az.shape or tr.shape != az.shape:
            raise DiskFractionError("azimuth, elevation and truncated must be 1-D and equal length")
        if az.size < MIN_MASK_SAMPLES:
            raise DiskFractionError(f"a horizon profile needs ≥ {MIN_MASK_SAMPLES} samples")
        if not (np.all(np.isfinite(az)) and np.all(np.isfinite(el))):
            raise DiskFractionError("horizon profile values must be finite")
        step = FULL_TURN_DEG / az.size
        expected = np.arange(az.size) * step
        if not np.allclose(az, expected, rtol=0.0, atol=step * STEP_RELATIVE_TOLERANCE * az.size):
            raise DiskFractionError(
                "azimuths must start at 0 with a uniform step covering [0, 360)"
            )
        object.__setattr__(self, "azimuth_deg", expected)
        object.__setattr__(self, "elevation_deg", el)
        object.__setattr__(self, "truncated", tr)

    @classmethod
    def astronomical(cls, samples: int = 360) -> HorizonProfile:
        """The local horizontal plane of the reference sphere (H ≡ 0°, C0)."""
        return cls(
            azimuth_deg=np.arange(samples, dtype=np.float64) * (FULL_TURN_DEG / samples),
            elevation_deg=np.zeros(samples),
            truncated=np.zeros(samples, dtype=np.bool_),
        )

    @property
    def step_deg(self) -> float:
        return FULL_TURN_DEG / self.azimuth_deg.size

    def elevation_at(self, azimuth_deg: ArrayLike) -> FloatArray:
        """Horizon elevation, linear and periodic interpolation in azimuth (C1)."""
        az = np.mod(np.asarray(azimuth_deg, dtype=np.float64), FULL_TURN_DEG)
        return np.interp(az, self.azimuth_deg, self.elevation_deg, period=FULL_TURN_DEG)

    def truncated_at(self, azimuth_deg: ArrayLike) -> BoolArray:
        """Whether the interpolated elevation depends on a truncated sample."""
        az = np.mod(np.asarray(azimuth_deg, dtype=np.float64), FULL_TURN_DEG)
        lower = np.floor(az / self.step_deg).astype(np.int64) % self.azimuth_deg.size
        upper = (lower + 1) % self.azimuth_deg.size
        on_sample = np.isclose(az, self.azimuth_deg[lower], rtol=0.0, atol=1e-12)
        return self.truncated[lower] | (~on_sample & self.truncated[upper])


@dataclass(frozen=True, slots=True)
class DiskFractionResult:
    """Per-epoch visible fractions of a disk above a horizon profile."""

    visible_fraction: FloatArray
    """Fraction of the disk's area above the horizon, [0, 1]."""
    horizon_elevation_deg: FloatArray
    """Horizon elevation at the disk centre's azimuth."""
    truncated: BoolArray
    """True where any part of the disk's azimuth span meets a truncated horizon sample:
    the fraction there is an upper bound, not an exact value."""
    nodes: int


def visible_disk_fraction(
    azimuth_deg: ArrayLike,
    elevation_deg: ArrayLike,
    angular_radius_deg: ArrayLike,
    horizon: HorizonProfile,
    *,
    nodes: int = DEFAULT_NODES,
) -> DiskFractionResult:
    """Visible fraction of disks centred at (azimuth, elevation) above ``horizon``.

    Inputs broadcast to shape (N,). Degrees throughout (C0).

    Raises:
        DiskFractionError: for non-finite inputs, non-positive radii, too few nodes, or
            disks too close to the zenith for the tangent-plane description.
    """
    az, el, radius = np.broadcast_arrays(
        np.atleast_1d(np.asarray(azimuth_deg, dtype=np.float64)),
        np.atleast_1d(np.asarray(elevation_deg, dtype=np.float64)),
        np.atleast_1d(np.asarray(angular_radius_deg, dtype=np.float64)),
    )
    if az.ndim != 1:
        raise DiskFractionError("inputs must broadcast to one dimension")
    if not (np.all(np.isfinite(az)) and np.all(np.isfinite(el)) and np.all(np.isfinite(radius))):
        raise DiskFractionError("inputs must be finite")
    if np.any(radius <= 0.0):
        raise DiskFractionError("angular radius must be positive")
    if nodes < 8:  # noqa: PLR2004 - a handful of chords cannot resolve a disk
        raise DiskFractionError("nodes must be ≥ 8")
    if np.any(np.abs(el) + radius > MAX_ABS_ELEVATION_DEG):
        raise DiskFractionError(
            f"disk extends beyond ±{MAX_ABS_ELEVATION_DEG}° elevation; the tangent-plane "
            "description is not valid there"
        )

    theta = (np.arange(nodes) + 0.5) / nodes * math.pi - math.pi / 2.0
    sin_t = np.sin(theta)
    cos_t = np.cos(theta)
    # Chord positions in azimuth and their half-heights, shape (N, nodes).
    chord_az = az[:, None] + (radius[:, None] * sin_t[None, :]) / np.cos(np.radians(el))[:, None]
    half_height = radius[:, None] * cos_t[None, :]
    horizon_el = horizon.elevation_at(chord_az)
    visible = np.clip(el[:, None] + half_height - horizon_el, 0.0, 2.0 * half_height)
    numerator = np.sum(visible * cos_t[None, :], axis=1)
    denominator = 2.0 * radius * np.sum(cos_t**2)
    fraction = np.clip(numerator / denominator, 0.0, 1.0)

    # Truncation: any horizon sample within the disk's azimuth span (edges included).
    edge_az = np.concatenate(
        [
            chord_az,
            (az + radius / np.cos(np.radians(el)))[:, None],
            (az - radius / np.cos(np.radians(el)))[:, None],
        ],
        axis=1,
    )
    truncated = np.any(horizon.truncated_at(edge_az), axis=1)
    return DiskFractionResult(
        visible_fraction=fraction,
        horizon_elevation_deg=horizon.elevation_at(az),
        truncated=truncated,
        nodes=nodes,
    )


def straight_horizon_fraction(
    elevation_above_horizon_deg: ArrayLike, angular_radius_deg: ArrayLike
) -> FloatArray:
    """Analytical fraction of a disk above a straight horizon (circular segment).

    f = 1 − (acos d − d·√(1 − d²)) / π with d = clamp((e − H) / r, −1, 1).
    Used as the reference for the quadrature and as documentation of the D4 formula.
    """
    d = np.clip(
        np.asarray(elevation_above_horizon_deg, dtype=np.float64)
        / np.asarray(angular_radius_deg, dtype=np.float64),
        -1.0,
        1.0,
    )
    result: FloatArray = 1.0 - (np.arccos(d) - d * np.sqrt(1.0 - d * d)) / math.pi
    return result


__all__ = [
    "DEFAULT_NODES",
    "DiskFractionError",
    "DiskFractionResult",
    "HorizonProfile",
    "straight_horizon_fraction",
    "visible_disk_fraction",
]
