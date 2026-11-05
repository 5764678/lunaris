"""Horizon mask computation (task T-15, contract C1): analytical cases first."""

from __future__ import annotations

import math
import os
import time
from pathlib import Path

import numpy as np
import pytest

from lunaris_science.coordinates import CoordinateError, spherical_to_cartesian
from lunaris_science.terrain.dem import PolarDem
from lunaris_science.terrain.horizon import HorizonError, compute_horizon_mask
from lunaris_science.terrain.polar_stereographic import (
    PolarStereographicGrid,
    SouthPolarStereographic,
)

R = 1_737_400.0
PROJ = SouthPolarStereographic(R)
REAL_LABEL = (
    Path(os.environ.get("LUNARIS_DATA_DIR", "data")) / "raw/lola-ldem-75s-240m/LDEM_75S_240M.LBL"
)


def synthetic_dem(
    height_of_distance, *, site: tuple[float, float], half_m: float, scale: float
) -> PolarDem:
    """SYNTHETIC DEM centred on the site's map point; height = f(great-circle distance)."""
    cx, cy = (float(v) for v in PROJ.forward(*site))
    n = int(2 * half_m / scale) + 1
    offset = (n - 1) / 2
    grid = PolarStereographicGrid(n, n, offset + cy / scale, offset - cx / scale, scale, PROJ)
    lines = np.arange(n, dtype=np.float64)[:, None]
    samples = np.arange(n, dtype=np.float64)[None, :]
    lat, lon = grid.pixel_to_latlon(*np.broadcast_arrays(lines, samples))
    u = spherical_to_cartesian(lat, lon, 1.0)
    u0 = spherical_to_cartesian(site[0], site[1], 1.0)
    s = R * np.arccos(np.clip(u @ u0, -1.0, 1.0))
    heights = np.asarray(height_of_distance(s), dtype=np.float32)
    return PolarDem(heights, grid, R, "synthetic", "synthetic", "0" * 64, "MOON_ME")


def ldem_extent_dem(scale: float = 1920.0) -> PolarDem:
    """Zero heights over the LDEM_75S_240M extent (±457.44 km), coarse grid."""
    n = int(2 * 457_440 / scale)
    offset = (n - 1) / 2
    grid = PolarStereographicGrid(n, n, offset, offset, scale, PROJ)
    return PolarDem(np.zeros((n, n), np.float32), grid, R, "synthetic", "s", "0" * 64, "MOON_ME")


@pytest.mark.parametrize("observer_height_m", [2.0, 100.0, 1000.0])
def test_zero_height_sphere_gives_geometric_dip(observer_height_m: float) -> None:
    site = (-88.0, 45.0)
    dem = synthetic_dem(lambda s: 0.0 * s, site=site, half_m=210_000.0, scale=400.0)
    mask = compute_horizon_mask(
        dem, *site, observer_height_m=observer_height_m, ray_step_m=50.0, min_range_m=50.0
    )
    expected = -math.degrees(math.acos(R / (R + observer_height_m)))
    assert np.max(np.abs(mask.elevation_deg - expected)) < 0.01
    assert not mask.any_truncated
    assert mask.size == 1440
    assert mask.surface_height_m == 0.0


def test_axisymmetric_crater_gives_analytic_angle() -> None:
    """Bowl rising linearly to a rim of height H at distance D, flat beyond.

    For an axisymmetric profile h(s) the horizon is the same at every azimuth and equals
    max over s of the exact closed form e(s) = atan2((R+h)cos(s/R) - r_O, (R+h)sin(s/R)).
    Curvature (≈ −s/2R) puts that maximum inside the bowl, not at the rim, so the
    reference maximizes the closed form at 0.1 m resolution: no DEM, no interpolation.
    """
    site, rim_d, rim_h, h_obs = (-88.0, 100.0), 20_000.0, 2_000.0, 2.0

    def profile(s: np.ndarray) -> np.ndarray:
        return np.where(s <= rim_d, rim_h * s / rim_d, 0.0)

    dem = synthetic_dem(profile, site=site, half_m=30_000.0, scale=50.0)
    mask = compute_horizon_mask(
        dem, *site, observer_height_m=h_obs, max_range_m=28_000.0, ray_step_m=10.0
    )
    s = np.arange(50.0, 28_000.0, 0.1)
    r = R + profile(s)
    r_o = R + 0.0 + h_obs
    expected = float(np.max(np.degrees(np.arctan2(r * np.cos(s / R) - r_o, r * np.sin(s / R)))))
    assert np.max(np.abs(mask.elevation_deg - expected)) < 0.01
    # Without curvature the answer would be the rim angle atan(H / D) = 5.71°: the
    # curvature term matters at this accuracy.
    assert abs(expected - math.degrees(math.atan(rim_h / rim_d))) > 0.05
    assert not mask.any_truncated


def test_step_wall_in_one_direction_and_azimuth_convention() -> None:
    """A wall only toward local east (azimuth 90°) raises the horizon only there."""
    site = (-85.0, 0.0)  # local north is toward 180° E (over the pole); east toward 90° E
    x0, y0 = (float(v) for v in PROJ.forward(*site))

    def heights(s: np.ndarray) -> np.ndarray:
        return 0.0 * s

    dem = synthetic_dem(heights, site=site, half_m=40_000.0, scale=200.0)
    lines = np.arange(dem.grid.lines, dtype=np.float64)[:, None]
    samples = np.arange(dem.grid.samples, dtype=np.float64)[None, :]
    x, y = np.broadcast_arrays(*dem.grid.pixel_to_map(lines, samples))
    # At lon 0 the map +x axis points toward 90° E, i.e. local east.
    wall = (x - x0 > 9_000) & (x - x0 < 11_000) & (np.abs(y - y0) < 3_000)
    h = np.where(wall, 1_000.0, 0.0).astype(np.float32)
    dem = PolarDem(h, dem.grid, R, "synthetic", "s", "0" * 64, "MOON_ME")
    mask = compute_horizon_mask(dem, *site, observer_height_m=2.0, max_range_m=35_000.0)
    east = float(mask.elevation_at(90.0))
    west = float(mask.elevation_at(270.0))
    assert east > 4.0  # ~ atan(1000 / 9000) ≈ 6.3°, minus curvature and interpolation
    assert west < 0.0


def test_site_at_78s_is_truncated_toward_the_north_only() -> None:
    dem = ldem_extent_dem()
    mask = compute_horizon_mask(dem, -78.0, 30.0, observer_height_m=2.0, azimuth_step_deg=1.0)
    # North points away from the pole: the 75° S edge is ~91 km away (< 200 km).
    assert bool(mask.truncated_at(0.0))
    assert mask.truncated[(mask.azimuth_deg >= 345) | (mask.azimuth_deg <= 15)].all()
    # South (toward the pole) stays inside coverage for the full 200 km.
    assert not bool(mask.truncated_at(180.0))
    assert np.all(np.isfinite(mask.elevation_deg))


def test_parameter_validation() -> None:
    dem = ldem_extent_dem(scale=9600.0)
    with pytest.raises(CoordinateError):
        compute_horizon_mask(dem, -90.0, 0.0, observer_height_m=2.0)
    with pytest.raises(HorizonError):
        compute_horizon_mask(dem, -85.0, 0.0, observer_height_m=-1.0)
    with pytest.raises(HorizonError):
        compute_horizon_mask(dem, -85.0, 0.0, observer_height_m=2.0, azimuth_step_deg=0.7)
    with pytest.raises(HorizonError):
        compute_horizon_mask(dem, -70.0, 0.0, observer_height_m=2.0)  # no DEM at the site


@pytest.mark.skipif(not REAL_LABEL.is_file(), reason="LDEM_75S_240M not acquired")
def test_real_ldem_mask_quarter_degree_200_km_under_30_s() -> None:
    from lunaris_data.readers.ldem import read_ldem_polar  # noqa: PLC0415 - optional data

    dem = read_ldem_polar(REAL_LABEL, "lola-ldem-75s-240m")
    start = time.perf_counter()
    mask = compute_horizon_mask(dem, -89.45, 222.69, observer_height_m=2.0)
    elapsed = time.perf_counter() - start
    assert elapsed < 30.0, elapsed
    assert mask.size == 1440
    assert mask.max_range_m == 200_000.0
    assert not mask.any_truncated  # 89.45° S: 200 km stays inside 75° S everywhere
    assert mask.dem_sha256 == "d031efe2611b17dfbf3c158f5e15dc04cd5719349dcbf6384bb21fd97697c490"
    # A connecting-ridge site sees a low horizon: within a few degrees of the plane.
    assert -3.0 < float(mask.elevation_deg.min()) < float(mask.elevation_deg.max()) < 5.0
    truncated_78 = compute_horizon_mask(
        dem, -78.0, 30.0, observer_height_m=2.0, azimuth_step_deg=1.0
    )
    assert bool(truncated_78.truncated_at(0.0))
    assert not bool(truncated_78.truncated_at(180.0))
