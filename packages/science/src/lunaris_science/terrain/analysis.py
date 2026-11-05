"""Site terrain analysis on a polar stereographic DEM: height, slope, roughness, hazards.

Definitions (``docs/SCIENCE.md`` §5.1):

* **Height** — bilinear interpolation of the DEM at the site, metres above the
  reference sphere.
* **Slope** — Horn (1981) 3 × 3 finite differences::

      ∂h/∂x = [(c + 2f + i) − (a + 2d + g)] / (8 Δx)
      ∂h/∂y = [(g + 2h + i) − (a + 2b + c)] / (8 Δy)
      slope = atan(√((∂h/∂x)² + (∂h/∂y)²))

  with the **ground** spacing Δx = Δy = MAP_SCALE / k, where k = 1 + (ρ/2R)² is the
  polar stereographic point scale factor at the pixel (distances on the map are k times
  ground distances). **Baseline** of a Horn slope: 2 Δx, the ground distance between
  the pixel centres the operator differences.
* **Roughness** — RMS of the height residuals after removing the least-squares plane
  fitted to all DEM cells whose centres lie within a circle of ground diameter D around
  the site. **Baseline** of a roughness value: D.
* **Footprint statistics** — over the cells whose centres lie within the footprint
  radius: count, missing cells, height range, and slope mean / 95th percentile / max.
* **Hazard indicators** — only when thresholds are supplied. Thresholds are mission
  assumptions, returned with the result; LUNARIS ships no default "safe" slope.

Missing DEM cells are NaN and never zero. A slope next to a missing cell is NaN, and
statistics report the number of missing cells instead of filling them.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from lunaris_science.terrain.dem import PolarDem

FloatArray = NDArray[np.float64]

SLOPE_METHOD = (
    "Horn (1981) 3×3 finite differences on the polar stereographic grid, ground spacing "
    "= MAP_SCALE / k with k = 1 + (ρ/2R)² at each pixel; slope = atan(|∇h|)."
)
ROUGHNESS_METHOD = (
    "RMS of height residuals after removing the least-squares plane fitted to the DEM "
    "cells whose centres lie within a circle of the stated ground diameter (the baseline)."
)
SLOPE_PERCENTILE = 95.0
_MIN_PLANE_CELLS = 3


class TerrainAnalysisError(ValueError):
    """Raised for invalid analysis parameters or a site outside the DEM."""


@dataclass(frozen=True, slots=True)
class HazardThresholds:
    """Mission-specific assumptions; each is optional and only applied when given."""

    max_slope_deg: float | None = None
    max_roughness_m: float | None = None

    def __post_init__(self) -> None:
        if self.max_slope_deg is not None and not 0.0 < self.max_slope_deg < 90.0:  # noqa: PLR2004
            raise TerrainAnalysisError("max_slope_deg must be within (0, 90)")
        if self.max_roughness_m is not None and not self.max_roughness_m > 0.0:
            raise TerrainAnalysisError("max_roughness_m must be positive")


@dataclass(frozen=True, slots=True)
class SlopeValue:
    slope_deg: float
    baseline_m: float


@dataclass(frozen=True, slots=True)
class FootprintStatistics:
    radius_m: float
    cell_count: int
    missing_cell_count: int
    height_min_m: float
    height_max_m: float
    height_mean_m: float
    slope_mean_deg: float
    slope_p95_deg: float
    slope_max_deg: float
    slope_baseline_m: float
    roughness_rms_m: float
    roughness_baseline_m: float


@dataclass(frozen=True, slots=True)
class HazardAssessment:
    thresholds: HazardThresholds
    slope_fraction_above: float | None
    """Fraction of footprint cells with a defined slope above ``max_slope_deg``."""
    slope_exceeds: bool | None
    """95th-percentile slope above ``max_slope_deg``."""
    roughness_exceeds: bool | None


@dataclass(frozen=True, slots=True)
class SiteTerrain:
    latitude_deg: float
    longitude_deg: float
    height_m: float
    slope_at_site: SlopeValue
    footprint: FootprintStatistics
    hazard: HazardAssessment | None
    dem_resolution_m: float
    scale_factor: float
    """Point scale factor k at the site."""


def ground_spacing_m(dem: PolarDem) -> FloatArray:
    """Ground spacing of each cell, m: MAP_SCALE / k(ρ) evaluated at the cell centre."""
    lines = np.arange(dem.grid.lines, dtype=np.float64)[:, np.newaxis]
    samples = np.arange(dem.grid.samples, dtype=np.float64)[np.newaxis, :]
    x, y = dem.grid.pixel_to_map(lines, samples)
    k = dem.grid.projection.scale_factor_at_map(x, y)
    spacing: FloatArray = dem.grid.map_scale_m / k
    return spacing


def horn_slope_deg(dem: PolarDem, *, scale_corrected: bool = True) -> FloatArray:
    """Horn slope (deg) of every cell; NaN on the border and next to missing cells.

    With ``scale_corrected=False`` the projected spacing (MAP_SCALE) is used instead of
    the ground spacing, which is what generic tools such as ``gdaldem slope`` do.
    """
    h = dem.heights_m.astype(np.float64)
    if h.shape[0] < 3 or h.shape[1] < 3:  # noqa: PLR2004
        raise TerrainAnalysisError("Horn slope needs at least 3 × 3 cells")
    a, b, c = h[:-2, :-2], h[:-2, 1:-1], h[:-2, 2:]
    d, f = h[1:-1, :-2], h[1:-1, 2:]
    g, hh, i = h[2:, :-2], h[2:, 1:-1], h[2:, 2:]
    if scale_corrected:
        spacing = ground_spacing_m(dem)[1:-1, 1:-1]
    else:
        spacing = np.full(b.shape, dem.grid.map_scale_m)
    dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8.0 * spacing)
    dzdy = ((g + 2 * hh + i) - (a + 2 * b + c)) / (8.0 * spacing)
    slope = np.full(h.shape, np.nan)
    slope[1:-1, 1:-1] = np.degrees(np.arctan(np.hypot(dzdx, dzdy)))
    return slope


def plane_residual_rms(x: FloatArray, y: FloatArray, h: FloatArray) -> float:
    """RMS of residuals after a least-squares plane h ≈ a x + b y + c."""
    if h.size < _MIN_PLANE_CELLS:
        return math.nan
    design = np.column_stack([x, y, np.ones_like(x)])
    coefficients, *_ = np.linalg.lstsq(design, h, rcond=None)
    residual = h - design @ coefficients
    return float(np.sqrt(np.mean(residual**2)))


def analyze_site(
    dem: PolarDem,
    latitude_deg: float,
    longitude_deg: float,
    *,
    footprint_radius_m: float,
    thresholds: HazardThresholds | None = None,
) -> SiteTerrain:
    """Terrain values for one site (see the module docstring for every definition).

    Raises:
        TerrainAnalysisError: invalid radius, a footprint that does not fit inside the
            DEM, or a site whose height is missing.
    """
    if not math.isfinite(footprint_radius_m) or footprint_radius_m <= 0.0:
        raise TerrainAnalysisError("footprint_radius_m must be positive")
    grid = dem.grid
    projection = grid.projection
    x0, y0 = (float(v) for v in projection.forward(latitude_deg, longitude_deg))
    k = float(projection.scale_factor_at_map(x0, y0))
    spacing = grid.map_scale_m / k

    line_f, sample_f = (float(v) for v in grid.map_to_pixel(x0, y0))
    reach_px = footprint_radius_m * k / grid.map_scale_m + 2.0
    if not (
        line_f - reach_px >= 0
        and sample_f - reach_px >= 0
        and line_f + reach_px <= grid.lines - 1
        and sample_f + reach_px <= grid.samples - 1
    ):
        raise TerrainAnalysisError("the footprint does not fit inside the DEM")

    height = float(dem.sample_bilinear(line_f, sample_f))
    if not math.isfinite(height):
        raise TerrainAnalysisError("the DEM has no value at the site")

    slope = horn_slope_deg(dem)
    site_slope = float(slope[round(line_f), round(sample_f)])

    lines = np.arange(grid.lines, dtype=np.float64)[:, np.newaxis]
    samples = np.arange(grid.samples, dtype=np.float64)[np.newaxis, :]
    xs, ys = grid.pixel_to_map(lines, samples)
    xs, ys = np.broadcast_arrays(xs, ys)
    ground_distance = np.hypot(xs - x0, ys - y0) / k
    inside = ground_distance <= footprint_radius_m
    heights = dem.heights_m.astype(np.float64)[inside]
    slopes = slope[inside]
    valid_h = np.isfinite(heights)
    valid_s = np.isfinite(slopes)
    if not np.any(valid_h):
        raise TerrainAnalysisError("the footprint has no DEM values")

    roughness = plane_residual_rms(
        xs[inside][valid_h] / k, ys[inside][valid_h] / k, heights[valid_h]
    )
    footprint = FootprintStatistics(
        radius_m=footprint_radius_m,
        cell_count=int(inside.sum()),
        missing_cell_count=int((~valid_h).sum()),
        height_min_m=float(np.min(heights[valid_h])),
        height_max_m=float(np.max(heights[valid_h])),
        height_mean_m=float(heights[valid_h].mean()),
        slope_mean_deg=float(slopes[valid_s].mean()) if valid_s.any() else math.nan,
        slope_p95_deg=float(np.percentile(slopes[valid_s], SLOPE_PERCENTILE))
        if valid_s.any()
        else math.nan,
        slope_max_deg=float(np.max(slopes[valid_s])) if valid_s.any() else math.nan,
        slope_baseline_m=2.0 * spacing,
        roughness_rms_m=roughness,
        roughness_baseline_m=2.0 * footprint_radius_m,
    )

    hazard = None
    if thresholds is not None:
        fraction = exceeds = rough = None
        if thresholds.max_slope_deg is not None and valid_s.any():
            fraction = float(np.mean(slopes[valid_s] > thresholds.max_slope_deg))
            exceeds = footprint.slope_p95_deg > thresholds.max_slope_deg
        if thresholds.max_roughness_m is not None and math.isfinite(roughness):
            rough = roughness > thresholds.max_roughness_m
        hazard = HazardAssessment(thresholds, fraction, exceeds, rough)

    return SiteTerrain(
        latitude_deg=float(latitude_deg),
        longitude_deg=float(longitude_deg),
        height_m=height,
        slope_at_site=SlopeValue(site_slope, 2.0 * spacing),
        footprint=footprint,
        hazard=hazard,
        dem_resolution_m=grid.map_scale_m,
        scale_factor=k,
    )


__all__ = [
    "ROUGHNESS_METHOD",
    "SLOPE_METHOD",
    "FootprintStatistics",
    "HazardAssessment",
    "HazardThresholds",
    "SiteTerrain",
    "SlopeValue",
    "TerrainAnalysisError",
    "analyze_site",
    "ground_spacing_m",
    "horn_slope_deg",
    "plane_residual_rms",
]
