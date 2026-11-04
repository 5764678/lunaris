"""In-memory polar stereographic DEM with provenance (no I/O; readers live in lunaris-data).

Heights are metres above the reference sphere of radius ``reference_radius_m``; cells
without a DEM value are NaN. NaN is never replaced by zero: a sample that touches a NaN
cell, or falls outside the grid, is NaN (``docs/TASKS.md`` §1 rule 4).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import ArrayLike, NDArray

from lunaris_science.provenance import SHA256_HEX_LENGTH
from lunaris_science.terrain.polar_stereographic import PolarStereographicGrid

FloatArray = NDArray[np.float64]


class DemError(ValueError):
    """Raised when a DEM is inconsistent with its grid or provenance."""


@dataclass(frozen=True, slots=True)
class PolarDem:
    """A south polar stereographic height grid.

    Attributes:
        heights_m: shape ``(lines, samples)``, float32, metres above the sphere, NaN where
            the product has no value. Read-only.
        grid: pixel ↔ map ↔ planetocentric geometry of ``heights_m``.
        reference_radius_m: radius of the sphere the heights refer to, m.
        dataset_id: manifest id of the source product.
        file_name: name of the data file.
        sha256: SHA-256 of the data file (lower-case hex).
        frame: body-fixed frame name stated by the product label.
    """

    heights_m: NDArray[np.float32]
    grid: PolarStereographicGrid
    reference_radius_m: float
    dataset_id: str
    file_name: str
    sha256: str
    frame: str

    def __post_init__(self) -> None:
        heights = np.asarray(self.heights_m)
        if heights.dtype != np.float32 or heights.ndim != 2:  # noqa: PLR2004
            raise DemError("heights_m must be a 2-D float32 array")
        if heights.shape != (self.grid.lines, self.grid.samples):
            raise DemError(
                f"heights shape {heights.shape} does not match grid "
                f"({self.grid.lines}, {self.grid.samples})"
            )
        if not math.isfinite(self.reference_radius_m) or self.reference_radius_m <= 0.0:
            raise DemError("reference_radius_m must be positive")
        if self.reference_radius_m != self.grid.projection.radius_m:
            raise DemError("the projection sphere and the height reference sphere differ")
        if len(self.sha256) != SHA256_HEX_LENGTH or self.sha256.lower() != self.sha256:
            raise DemError("sha256 must be 64 lower-case hexadecimal characters")
        heights.setflags(write=False)
        object.__setattr__(self, "heights_m", heights)

    @property
    def resolution_m(self) -> float:
        """Nominal grid spacing (true at the pole), m."""
        return self.grid.map_scale_m

    def sample_bilinear(self, line: ArrayLike, sample: ArrayLike) -> FloatArray:
        """Bilinear height (m) at fractional 0-based pixel-centre coordinates.

        NaN outside the span of pixel centres or where any of the four cells is NaN.
        """
        ln = np.asarray(line, dtype=np.float64)
        sp = np.asarray(sample, dtype=np.float64)
        ln, sp = np.broadcast_arrays(ln, sp)
        out = np.full(ln.shape, np.nan, dtype=np.float64)
        inside = (
            np.isfinite(ln)
            & np.isfinite(sp)
            & (ln >= 0.0)
            & (ln <= self.grid.lines - 1)
            & (sp >= 0.0)
            & (sp <= self.grid.samples - 1)
        )
        if not np.any(inside):
            return out
        li, si = ln[inside], sp[inside]
        l0 = np.minimum(np.floor(li).astype(np.intp), self.grid.lines - 2)
        s0 = np.minimum(np.floor(si).astype(np.intp), self.grid.samples - 2)
        fl, fs = li - l0, si - s0
        h = self.heights_m
        value = (
            (1 - fl) * (1 - fs) * h[l0, s0]
            + (1 - fl) * fs * h[l0, s0 + 1]
            + fl * (1 - fs) * h[l0 + 1, s0]
            + fl * fs * h[l0 + 1, s0 + 1]
        )
        out[inside] = value
        return out

    def height_at(self, latitude_deg: ArrayLike, longitude_deg: ArrayLike) -> FloatArray:
        """Bilinear height (m above the sphere) at planetocentric coordinates; NaN if absent."""
        return self.sample_bilinear(*self.grid.latlon_to_pixel(latitude_deg, longitude_deg))


__all__ = ["DemError", "PolarDem"]
