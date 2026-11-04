"""Terrain horizon mask by ray marching over a polar stereographic DEM (task T-15, C1).

For a site with planetocentric (φ, λ) on the reference sphere of radius R, the eye point
is O = (R + h_s + h_o) · û, where û is the radial unit vector at the site, h_s the DEM
height at the site (bilinear) and h_o the observer height above the surface. The local
frame follows contract C0: up = û (the sphere's radial direction, never the terrain
normal), east = ẑ × up / |ẑ × up|, north = up × east, azimuth clockwise from north.

Each azimuth A is marched along the **great circle** leaving the site in direction
d = cos A · north + sin A · east. The ground point at great-circle distance s is

    P̂(s) = cos(s/R) · û + sin(s/R) · d                     (a unit vector)

so distances are measured on the sphere, not on the map, and need no projection
scale-factor correction. The terrain point is T = (R + h(s)) · P̂(s), with h(s) the DEM
height sampled bilinearly at P̂(s). Its elevation angle above the local horizontal plane
at the site is computed exactly (curvature included, no flat-Moon approximation):

    e(s) = atan2((R + h) cos(s/R) − |O|, (R + h) sin(s/R))

The horizon at A is max over s of e(s), for s from ``min_range_m`` to ``max_range_m`` in
steps of ``ray_step_m``.

Truncation: if any sample along a ray has no DEM value (outside the grid or a missing
cell), the azimuth is flagged ``truncated`` and its elevation, the maximum over the
samples that do have values, is only a lower bound (terrain beyond the gap could raise
it). A ray with no valid sample at all reports −90° and is flagged. Missing coverage is
never treated as zero height.
"""

from __future__ import annotations

import math

import numpy as np

from lunaris_science.coordinates import (
    CoordinateError,
    SelenographicCoordinate,
    spherical_to_cartesian,
)
from lunaris_science.horizon_mask import HorizonMask
from lunaris_science.terrain.dem import PolarDem

DEFAULT_AZIMUTH_STEP_DEG = 0.25
DEFAULT_MAX_RANGE_M = 200_000.0
_NO_DATA_ELEVATION_DEG = -90.0


class HorizonError(ValueError):
    """Raised for invalid horizon parameters or a site without a DEM height."""


def horizon_method(ray_step_m: float, min_range_m: float) -> str:
    return (
        "Ray march along great circles of the reference sphere (ground distance on the "
        f"sphere, step {ray_step_m:g} m, from {min_range_m:g} m), bilinear DEM heights, "
        "exact 3D elevation angle above the site's radial horizontal plane "
        "(curvature included); truncated where a ray meets missing DEM coverage."
    )


def compute_horizon_mask(
    dem: PolarDem,
    latitude_deg: float,
    longitude_deg: float,
    *,
    observer_height_m: float,
    azimuth_step_deg: float = DEFAULT_AZIMUTH_STEP_DEG,
    max_range_m: float = DEFAULT_MAX_RANGE_M,
    ray_step_m: float | None = None,
    min_range_m: float | None = None,
) -> HorizonMask:
    """Compute the terrain horizon mask (contract C1) of a site.

    Args:
        dem: polar stereographic DEM; heights above its reference sphere.
        latitude_deg, longitude_deg: site, planetocentric, MOON_ME; latitude strictly
            inside (−90, 90).
        observer_height_m: eye height above the DEM surface at the site, m (≥ 0).
        azimuth_step_deg: uniform step; 360 must be an integer multiple of it (N ≥ 360).
        max_range_m: ray length, ground distance on the sphere, m.
        ray_step_m: sampling step along each ray, m; default half the DEM spacing.
        min_range_m: first sample distance, m; default one DEM spacing, so the cell the
            observer stands on is not taken as an obstruction.

    Raises:
        HorizonError: invalid parameters, or no DEM height at the site.
        CoordinateError: latitude ±90° (azimuth undefined).
    """
    site = SelenographicCoordinate(latitude_deg, longitude_deg)
    if abs(site.latitude_deg) == 90.0:  # noqa: PLR2004
        raise CoordinateError("azimuth is undefined at latitude ±90°")
    if not math.isfinite(observer_height_m) or observer_height_m < 0.0:
        raise HorizonError("observer_height_m must be finite and non-negative")
    n_az = 360.0 / azimuth_step_deg if azimuth_step_deg > 0 else 0.0
    n_azimuth = round(n_az)
    if n_azimuth < 360 or abs(n_az - n_azimuth) > 1e-9:  # noqa: PLR2004
        raise HorizonError("azimuth_step_deg must divide 360 into at least 360 steps")
    resolution = dem.resolution_m
    step = ray_step_m if ray_step_m is not None else 0.5 * resolution
    start = min_range_m if min_range_m is not None else resolution
    if not (step > 0 and 0 <= start < max_range_m):
        raise HorizonError("need ray_step_m > 0 and 0 ≤ min_range_m < max_range_m")

    radius = dem.reference_radius_m
    surface = float(dem.height_at(site.latitude_deg, site.longitude_deg))
    if not math.isfinite(surface):
        raise HorizonError("the DEM has no height at the site")
    observer_radius = radius + surface + observer_height_m

    up = spherical_to_cartesian(site.latitude_deg, site.longitude_deg, 1.0)
    east = np.cross([0.0, 0.0, 1.0], up)
    east /= np.linalg.norm(east)
    north = np.cross(up, east)

    azimuth = np.arange(n_azimuth, dtype=np.float64) * (360.0 / n_azimuth)
    az_rad = np.deg2rad(azimuth)
    direction = np.cos(az_rad)[:, None] * north + np.sin(az_rad)[:, None] * east  # (N, 3)
    distance = np.arange(start, max_range_m + 0.5 * step, step)
    distance = distance[distance <= max_range_m]
    theta = distance / radius
    cos_t, sin_t = np.cos(theta), np.sin(theta)

    elevation = np.empty(n_azimuth)
    truncated = np.empty(n_azimuth, dtype=bool)
    chunk = max(1, 4_000_000 // max(1, distance.size))
    for lo in range(0, n_azimuth, chunk):
        d = direction[lo : lo + chunk]  # (n, 3)
        points = cos_t[None, :, None] * up + sin_t[None, :, None] * d[:, None, :]
        horizontal = np.hypot(points[..., 0], points[..., 1])
        lat = np.rad2deg(np.arctan2(points[..., 2], horizontal))
        lon = np.rad2deg(np.arctan2(points[..., 1], points[..., 0]))
        line, sample = dem.grid.latlon_to_pixel(lat, lon)
        h = dem.sample_bilinear(line, sample)
        valid = np.isfinite(h)
        r = radius + np.where(valid, h, 0.0)
        e = np.degrees(np.arctan2(r * cos_t - observer_radius, r * sin_t))
        e = np.where(valid, e, -np.inf)
        best = e.max(axis=1)
        elevation[lo : lo + chunk] = np.where(np.isfinite(best), best, _NO_DATA_ELEVATION_DEG)
        truncated[lo : lo + chunk] = ~valid.all(axis=1)

    return HorizonMask(
        site=SelenographicCoordinate(site.latitude_deg, site.longitude_deg, surface),
        observer_height_m=float(observer_height_m),
        surface_height_m=surface,
        azimuth_deg=azimuth,
        elevation_deg=elevation,
        truncated=truncated,
        max_range_m=float(max_range_m),
        dem_source_id=dem.dataset_id,
        dem_sha256=dem.sha256,
        dem_resolution_m=resolution,
        method=horizon_method(step, start),
    )


__all__ = [
    "DEFAULT_AZIMUTH_STEP_DEG",
    "DEFAULT_MAX_RANGE_M",
    "HorizonError",
    "compute_horizon_mask",
    "horizon_method",
]
