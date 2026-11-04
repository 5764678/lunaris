"""Terrain scene vertex grid (task T-12, contract C3)."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from lunaris_data.readers.ldem import read_ldem_polar
from lunaris_science.coordinates import spherical_to_cartesian
from lunaris_science.terrain.dem import PolarDem
from lunaris_science.terrain.scene import SceneError, build_terrain_scene
from tests.fixtures.terrain.synthetic_ldem import planar_height_at_map, write_planar_ldem

R = 1_737_400.0
N, SCALE = 64, 8000.0


@pytest.fixture
def dem(tmp_path: Path) -> PolarDem:
    write_planar_ldem(tmp_path, n=N, scale_m=SCALE)
    return read_ldem_polar(tmp_path / "LDEM_75S_240M.LBL", "synthetic")


def _independent_vertex(row: int, col: int, grid: int, half: float) -> np.ndarray:
    """Expected MOON_ME position from first principles (no LUNARIS projection code)."""
    spacing = 2 * half / (grid - 1)
    x = -half + col * spacing
    y = half - row * spacing
    rho = np.hypot(x, y)
    lat = np.degrees(2 * np.arctan(rho / (2 * R))) - 90.0
    lon = np.degrees(np.arctan2(x, y)) % 360.0  # DSMAP_POLAR.CAT inverse
    h = planar_height_at_map(x, y, n=N, scale_m=SCALE)
    return spherical_to_cartesian(lat, lon, R + h)


def test_vertex_positions_match_spherical_to_cartesian(dem: PolarDem) -> None:
    grid, half = 101, 200_000.0
    scene = build_terrain_scene(dem, grid_size=grid, half_extent_m=half)
    origin = np.array(scene.origin_moon_me_m)
    np.testing.assert_allclose(origin, [0.0, 0.0, -R], atol=1e-6)
    for row, col in ((0, 0), (0, 100), (50, 50), (100, 0), (37, 81)):
        got = scene.vertices[row, col, :3].astype(np.float64) + origin
        expected = _independent_vertex(row, col, grid, half)
        np.testing.assert_allclose(got, expected, atol=0.05)  # float32 relative storage
        h = planar_height_at_map(
            -half + col * 2 * half / (grid - 1),
            half - row * 2 * half / (grid - 1),
            n=N,
            scale_m=SCALE,
        )
        assert float(scene.vertices[row, col, 3]) == pytest.approx(h, abs=1e-3)


def test_orientation_rows_and_columns(dem: PolarDem) -> None:
    scene = build_terrain_scene(dem, grid_size=3, half_extent_m=100_000.0)
    v = scene.vertices.astype(np.float64) + np.r_[scene.origin_moon_me_m, 0.0]
    # Row 0 middle column: top of the map = toward 0° E = +X_ME.
    assert v[0, 1, 0] > 0
    assert abs(v[0, 1, 1]) < 1e-3
    # Middle row, last column: toward 90° E = +Y_ME.
    assert v[1, 2, 1] > 0
    assert abs(v[1, 2, 0]) < 1e-3


def test_metadata_values(dem: PolarDem) -> None:
    scene = build_terrain_scene(dem, grid_size=11, half_extent_m=100_000.0)
    assert (scene.width, scene.height) == (11, 11)
    assert scene.vertex_spacing_m == 20_000.0
    heights = scene.vertices[..., 3]
    assert scene.height_min_m == float(heights.min())
    assert scene.height_max_m == float(heights.max())
    assert scene.nodata_vertex_count == 0
    raw = scene.to_bytes()
    assert len(raw) == 11 * 11 * 4 * 4
    decoded = np.frombuffer(raw, dtype="<f4").reshape(11, 11, 4)
    np.testing.assert_array_equal(decoded, scene.vertices)


def test_vertices_outside_dem_are_nan_never_zero(tmp_path: Path) -> None:
    write_planar_ldem(tmp_path, n=N, scale_m=SCALE, holes=((31, 31),))
    dem = read_ldem_polar(tmp_path / "LDEM_75S_240M.LBL", "synthetic")
    # DEM spans ±256 km; a ±300 km scene has an uncovered border.
    scene = build_terrain_scene(dem, grid_size=61, half_extent_m=300_000.0)
    assert np.isnan(scene.vertices[0, 0]).all()
    assert np.isnan(scene.vertices[30, 30]).all()  # next to the hole at the centre
    assert scene.nodata_vertex_count > 0
    drawable = scene.vertices[~np.isnan(scene.vertices[..., 3])]
    assert np.isfinite(drawable).all()


@pytest.mark.parametrize(
    "kwargs",
    [
        {"grid_size": 1, "half_extent_m": 1000.0},
        {"grid_size": 1025, "half_extent_m": 1000.0},
        {"grid_size": 10, "half_extent_m": 0.0},
        {"grid_size": 10, "half_extent_m": 1000.0, "center_map_m": (5e6, 0.0)},
    ],
)
def test_invalid_parameters(dem: PolarDem, kwargs: dict[str, object]) -> None:
    with pytest.raises(SceneError):
        build_terrain_scene(dem, **kwargs)  # type: ignore[arg-type]
