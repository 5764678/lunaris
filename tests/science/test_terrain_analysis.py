"""Site terrain analysis: Horn slope, roughness, footprint, hazards (task T-14)."""

from __future__ import annotations

import math
import shutil
import subprocess
from pathlib import Path

import numpy as np
import pytest

from lunaris_science.terrain.analysis import (
    HazardThresholds,
    TerrainAnalysisError,
    analyze_site,
    horn_slope_deg,
    plane_residual_rms,
)
from lunaris_science.terrain.dem import PolarDem
from lunaris_science.terrain.polar_stereographic import (
    PolarStereographicGrid,
    SouthPolarStereographic,
)

R = 1_737_400.0
PROJ = SouthPolarStereographic(R)


def make_dem(
    heights_fn, *, n: int = 201, scale: float = 20.0, center: tuple[float, float] = (0.0, 0.0)
) -> PolarDem:
    """SYNTHETIC DEM: an n × n grid centred on map point ``center``."""
    offset = (n - 1) / 2
    cx, cy = center
    grid = PolarStereographicGrid(
        lines=n,
        samples=n,
        line_projection_offset_px=offset + cy / scale,
        sample_projection_offset_px=offset - cx / scale,
        map_scale_m=scale,
        projection=PROJ,
    )
    lines = np.arange(n, dtype=np.float64)[:, None]
    samples = np.arange(n, dtype=np.float64)[None, :]
    x, y = grid.pixel_to_map(lines, samples)
    x, y = np.broadcast_arrays(x, y)
    heights = np.asarray(heights_fn(x, y), dtype=np.float32)
    return PolarDem(heights, grid, R, "synthetic", "synthetic", "0" * 64, "MOON_ME")


def _site(x: float, y: float) -> tuple[float, float]:
    lat, lon = PROJ.inverse(x, y)
    return float(lat), float(lon)


@pytest.mark.parametrize("theta_deg", [2.0, 10.0, 25.0, 40.0])
def test_plane_slope_near_pole(theta_deg: float) -> None:
    t = math.tan(math.radians(theta_deg))
    dem = make_dem(lambda x, y: t * (0.6 * x + 0.8 * y))  # gradient direction arbitrary
    slope = horn_slope_deg(dem)
    assert np.nanmax(np.abs(slope - theta_deg)) < 0.1
    result = analyze_site(dem, *_site(0.0, 0.0), footprint_radius_m=500.0)
    assert result.slope_at_site.slope_deg == pytest.approx(theta_deg, abs=0.1)
    assert result.slope_at_site.baseline_m == pytest.approx(40.0, rel=1e-6)
    assert result.footprint.roughness_rms_m < 0.01


def test_scale_correction_far_from_pole() -> None:
    """At ρ = 400 km (k ≈ 1.01325) a 30° slope reads atan(tan 30° / k) = 29.67° uncorrected."""
    cx = 400_000.0
    k = float(PROJ.scale_factor_at_map(cx, 0.0))
    t = math.tan(math.radians(30.0))
    dem = make_dem(lambda x, y: t * (x - cx) / k, center=(cx, 0.0))
    corrected = horn_slope_deg(dem)[100, 100]
    uncorrected = horn_slope_deg(dem, scale_corrected=False)[100, 100]
    assert corrected == pytest.approx(30.0, abs=0.01)
    assert uncorrected == pytest.approx(math.degrees(math.atan(t / k)), abs=0.01)
    assert abs(corrected - uncorrected) > 0.2
    result = analyze_site(dem, *_site(cx, 0.0), footprint_radius_m=300.0)
    assert result.scale_factor == pytest.approx(k)
    assert result.slope_at_site.baseline_m == pytest.approx(2 * 20.0 / k)


@pytest.mark.parametrize("theta_deg", [5.0, 20.0, 35.0])
def test_cone_slope(theta_deg: float) -> None:
    t = math.tan(math.radians(theta_deg))
    dem = make_dem(lambda x, y: -t * np.hypot(x, y))
    slope = horn_slope_deg(dem)
    lines, samples = np.mgrid[0:201, 0:201]
    r_px = np.hypot(lines - 100, samples - 100)
    annulus = (r_px > 10) & (r_px < 90)
    assert np.max(np.abs(slope[annulus] - theta_deg)) < 0.1


def test_roughness_definition() -> None:
    rng = np.random.default_rng(7)
    noise = rng.choice([-0.5, 0.5], size=(201, 201))
    dem = make_dem(lambda x, y: 0.05 * x - 0.02 * y + 1000.0 + noise)
    result = analyze_site(dem, *_site(0.0, 0.0), footprint_radius_m=1000.0)
    assert result.footprint.roughness_rms_m == pytest.approx(0.5, abs=0.02)
    assert result.footprint.roughness_baseline_m == 2000.0
    x = np.array([0.0, 1.0, 0.0, 1.0])
    y = np.array([0.0, 0.0, 1.0, 1.0])
    assert plane_residual_rms(x, y, 2 * x + 3 * y + 1) == pytest.approx(0.0, abs=1e-12)


def test_footprint_statistics_and_bilinear_height() -> None:
    dem = make_dem(lambda x, y: 0.01 * x + 500.0)
    lat, lon = _site(10.0, 0.0)  # half a cell east of the centre
    result = analyze_site(dem, lat, lon, footprint_radius_m=100.0)
    assert result.height_m == pytest.approx(500.1, abs=1e-3)
    fp = result.footprint
    # Cells within 100 m of a point between two cell centres (20 m grid).
    assert 70 <= fp.cell_count <= 90
    assert fp.missing_cell_count == 0
    assert fp.slope_mean_deg == pytest.approx(math.degrees(math.atan(0.01)), abs=1e-3)
    assert fp.slope_baseline_m == pytest.approx(40.0, rel=1e-6)


def test_hazard_thresholds_are_optional_assumptions() -> None:
    dem = make_dem(lambda x, y: np.where(x > 0, np.tan(np.radians(20.0)) * x, 0.0))
    site = _site(0.0, 0.0)
    assert analyze_site(dem, *site, footprint_radius_m=400.0).hazard is None
    result = analyze_site(
        dem, *site, footprint_radius_m=400.0, thresholds=HazardThresholds(max_slope_deg=15.0)
    )
    assert result.hazard is not None
    assert result.hazard.slope_fraction_above == pytest.approx(0.5, abs=0.06)
    assert result.hazard.slope_exceeds is True
    assert result.hazard.roughness_exceeds is None
    with pytest.raises(TerrainAnalysisError):
        HazardThresholds(max_slope_deg=95.0)


def test_missing_cells_are_counted_never_zero() -> None:
    def heights(x: np.ndarray, y: np.ndarray) -> np.ndarray:
        h = 0.01 * x
        return np.where((np.abs(x - 60) < 15) & (np.abs(y) < 15), np.nan, h)

    result = analyze_site(make_dem(heights), *_site(0.0, 0.0), footprint_radius_m=100.0)
    assert result.footprint.missing_cell_count == 1  # the cell centred at (60 m, 0)
    assert math.isfinite(result.footprint.slope_mean_deg)
    assert result.footprint.height_min_m == pytest.approx(-1.0, abs=1e-3)


def test_errors() -> None:
    dem = make_dem(lambda x, y: 0.0 * x, n=21)
    with pytest.raises(TerrainAnalysisError, match="fit"):
        analyze_site(dem, *_site(0.0, 0.0), footprint_radius_m=1000.0)
    with pytest.raises(TerrainAnalysisError, match="positive"):
        analyze_site(dem, *_site(0.0, 0.0), footprint_radius_m=0.0)


@pytest.mark.skipif(shutil.which("gdaldem") is None, reason="gdaldem not installed")
def test_uncorrected_horn_matches_gdaldem(tmp_path: Path) -> None:
    """With projected spacing, our Horn operator equals ``gdaldem slope`` (Horn default)."""
    import rasterio  # noqa: PLC0415 - optional cross-check dependency (lunaris-data has it)
    from rasterio.transform import Affine  # noqa: PLC0415

    rng = np.random.default_rng(3)
    base = rng.normal(0.0, 30.0, size=(64, 64)).cumsum(axis=0).cumsum(axis=1) / 20.0
    dem = make_dem(lambda x, y: base, n=64)
    src, dst = tmp_path / "dem.tif", tmp_path / "slope.tif"
    with rasterio.open(
        src,
        "w",
        driver="GTiff",
        width=64,
        height=64,
        count=1,
        dtype="float32",
        transform=Affine(20.0, 0, -640.0, 0, -20.0, 640.0),
    ) as out:
        out.write(dem.heights_m, 1)
    subprocess.run(["gdaldem", "slope", "-q", str(src), str(dst)], check=True)  # noqa: S607
    with rasterio.open(dst) as ds:
        reference = ds.read(1).astype(np.float64)
    ours = horn_slope_deg(dem, scale_corrected=False)
    inner = (slice(1, -1), slice(1, -1))
    assert np.max(np.abs(ours[inner] - reference[inner])) < 1e-3
