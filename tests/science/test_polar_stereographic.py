"""South polar stereographic projection and the LOLA polar pixel grid (task T-10)."""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pytest
from hypothesis import given
from hypothesis import strategies as st

from lunaris_science.constants import LOLA_REFERENCE_SPHERE_RADIUS
from lunaris_science.coordinates import CoordinateError, spherical_to_cartesian
from lunaris_science.terrain.polar_stereographic import (
    PolarStereographicGrid,
    SouthPolarStereographic,
)

R = LOLA_REFERENCE_SPHERE_RADIUS.value
PROJ = SouthPolarStereographic(R)
# LDEM_75S_240M label: 3812 x 3812, LINE/SAMPLE_PROJECTION_OFFSET 1905.5 px, MAP_SCALE 240 m.
LDEM_GRID = PolarStereographicGrid(3812, 3812, 1905.5, 1905.5, 240.0, PROJ)
ORIENTATION_FIXTURE = Path(__file__).parents[1] / "fixtures/terrain/ldem-75s-240m-orientation.json"


def _angle_diff_deg(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    return np.abs((np.asarray(a) - np.asarray(b) + 180.0) % 360.0 - 180.0)


def test_round_trip_dense_grid_75_to_90_south() -> None:
    lat = np.linspace(-89.999999, -75.0, 2001)
    lon = np.linspace(0.0, 359.99, 1801)
    lat_g, lon_g = np.meshgrid(lat, lon, indexing="ij")
    lat_r, lon_r = PROJ.inverse(*PROJ.forward(lat_g, lon_g))
    assert np.max(np.abs(lat_r - lat_g)) < 1e-9
    assert np.max(_angle_diff_deg(lon_r, lon_g)) < 1e-9


@given(
    lat=st.floats(min_value=-89.9999999, max_value=-75.0),
    lon=st.floats(min_value=0.0, max_value=360.0, exclude_max=True),
)
def test_round_trip_property(lat: float, lon: float) -> None:
    lat_r, lon_r = PROJ.inverse(*PROJ.forward(lat, lon))
    assert abs(float(lat_r) - lat) < 1e-9
    assert float(_angle_diff_deg(lon_r, lon)) < 1e-9


@given(
    x=st.floats(min_value=-460_000.0, max_value=460_000.0),
    y=st.floats(min_value=-460_000.0, max_value=460_000.0),
)
def test_map_round_trip_property(x: float, y: float) -> None:
    x_r, y_r = PROJ.forward(*PROJ.inverse(x, y))
    assert abs(float(x_r) - x) < 1e-6
    assert abs(float(y_r) - y) < 1e-6


def test_pole_maps_to_origin_and_back() -> None:
    x, y = PROJ.forward(-90.0, 123.0)
    assert float(x) == pytest.approx(0.0, abs=1e-9)
    assert float(y) == pytest.approx(0.0, abs=1e-9)
    lat, lon = PROJ.inverse(0.0, 0.0)
    assert float(lat) == -90.0
    assert float(lon) == 0.0  # undefined at the pole; documented convention


def test_radial_distance_closed_form() -> None:
    # rho(-75) = 2R tan(7.5 deg)
    assert float(PROJ.radial_distance_m(-75.0)) == pytest.approx(
        2 * R * math.tan(math.radians(7.5))
    )
    assert float(PROJ.radial_distance_m(0.0)) == pytest.approx(2 * R)  # equator: 2R


def test_scale_factor_values() -> None:
    assert float(PROJ.scale_factor(-90.0)) == 1.0
    k75 = float(PROJ.scale_factor(-75.0))
    assert k75 == pytest.approx(2.0 / (1.0 + math.sin(math.radians(75.0))), rel=1e-15)
    assert k75 == pytest.approx(1.0173, abs=5e-5)


@pytest.mark.parametrize("lat", [-89.9, -88.0, -85.0, -80.0, -75.0])
def test_scale_factor_matches_numerical_derivative(lat: float) -> None:
    # Along a meridian, ground distance is R dphi; map distance is d(rho).
    h = 1e-5
    drho = float(PROJ.radial_distance_m(lat + h) - PROJ.radial_distance_m(lat - h))
    ground = R * math.radians(2 * h)
    assert drho / ground == pytest.approx(float(PROJ.scale_factor(lat)), rel=1e-8)
    # Along a parallel, map circumference 2 pi rho vs ground 2 pi R cos(phi).
    parallel_k = float(PROJ.radial_distance_m(lat)) / (R * math.cos(math.radians(lat)))
    assert parallel_k == pytest.approx(float(PROJ.scale_factor(lat)), rel=1e-12)


def test_scale_factor_at_map_matches_latitude_form() -> None:
    lat = np.array([-89.0, -84.0, -79.0, -75.0])
    x, y = PROJ.forward(lat, 37.0)
    np.testing.assert_allclose(PROJ.scale_factor_at_map(x, y), PROJ.scale_factor(lat), rtol=1e-14)


def test_map_axes_relative_to_moon_me() -> None:
    """Map x is parallel to +Y_ME and map y to +X_ME (south pole seen from outside)."""
    lat = -85.0
    for lon in (0.0, 37.0, 90.0, 200.0, 315.0):
        x, y = PROJ.forward(lat, lon)
        xyz = spherical_to_cartesian(lat, lon, R)
        horizontal = R * math.cos(math.radians(lat))
        rho = float(PROJ.radial_distance_m(lat))
        assert float(x) / rho == pytest.approx(xyz[1] / horizontal, abs=1e-12)
        assert float(y) / rho == pytest.approx(xyz[0] / horizontal, abs=1e-12)


def test_projection_rejects_invalid_input() -> None:
    with pytest.raises(CoordinateError):
        PROJ.forward(90.0, 0.0)
    with pytest.raises(CoordinateError):
        PROJ.forward(-91.0, 0.0)
    with pytest.raises(CoordinateError):
        PROJ.inverse(math.nan, 0.0)
    with pytest.raises(CoordinateError):
        SouthPolarStereographic(0.0)


# ── LDEM_75S_240M label grid ────────────────────────────────────────────────


def test_label_grid_is_consistent_with_the_75s_boundary() -> None:
    """rho(75 S) ~ 1906 px x 240 m: the 3812 px grid spans 75 S at its edge midpoints."""
    rho_75 = float(PROJ.radial_distance_m(-75.0))
    x_min, x_max, y_min, y_max = LDEM_GRID.extent_m
    assert x_max == -x_min == y_max == -y_min == 1906 * 240.0
    assert abs(rho_75 - x_max) < 240.0  # within one pixel
    # Edge midpoint latitude is 75 S to within a hundredth of a degree.
    lat_edge, _ = PROJ.inverse(x_max, 0.0)
    assert float(lat_edge) == pytest.approx(-75.0, abs=0.01)


def test_pole_is_at_the_grid_centre() -> None:
    line, sample = LDEM_GRID.latlon_to_pixel(-90.0, 0.0)
    assert float(line) == 1905.5
    assert float(sample) == 1905.5


def test_grid_orientation_matches_dsmap_description() -> None:
    """Longitude 0 straight up (smaller line), 90 E to the right (larger sample)."""
    line, sample = LDEM_GRID.latlon_to_pixel(-80.0, 0.0)
    assert float(line) < 1905.5
    assert float(sample) == pytest.approx(1905.5)
    line, sample = LDEM_GRID.latlon_to_pixel(-80.0, 90.0)
    assert float(line) == pytest.approx(1905.5)
    assert float(sample) > 1905.5


def test_grid_round_trip_and_contains() -> None:
    line = np.array([0.0, 100.25, 1905.5, 3811.0])
    sample = np.array([3811.0, 7.5, 1905.5, 0.0])
    lat, lon = LDEM_GRID.pixel_to_latlon(line, sample)
    line_r, sample_r = LDEM_GRID.latlon_to_pixel(lat, lon)
    np.testing.assert_allclose(line_r, line, atol=1e-7)
    np.testing.assert_allclose(sample_r, sample, atol=1e-7)
    assert LDEM_GRID.contains_pixel(line, sample).all()
    assert not LDEM_GRID.contains_pixel(-0.6, 10.0)
    assert not LDEM_GRID.contains_pixel(10.0, 3811.6)


def test_dsmap_inverse_equations_reproduced() -> None:
    """DSMAP_POLAR.CAT inverse with 1-based I, J: X = (I - N/2 - 0.5)S, Y = -(J - N/2 - 0.5)S."""
    n, s = 3812, 240.0
    for i_1, j_1 in ((1, 1), (1000, 2500), (3812, 17)):
        x_ref = (i_1 - n / 2 - 0.5) * s
        y_ref = -(j_1 - n / 2 - 0.5) * s
        x, y = LDEM_GRID.pixel_to_map(j_1 - 1, i_1 - 1)
        assert float(x) == x_ref
        assert float(y) == y_ref


def test_orientation_against_independent_pgda_geotiff() -> None:
    """Real LDEM samples at the pixels our convention selects agree with PGDA heights.

    The fixture holds 8 points: LDEM DN at our pixel and at the pixels picked by a
    mirrored-sample or flipped-line convention, plus the mean height of the co-located
    240 m footprint in the PGDA 20 m GeoTIFF (independent georeferencing).
    """
    fixture = json.loads(ORIENTATION_FIXTURE.read_text(encoding="utf-8"))
    ours, mirrored, flipped = [], [], []
    for point in fixture["points"]:
        line, sample = LDEM_GRID.latlon_to_pixel(point["latitude_deg"], point["longitude_deg"])
        assert round(float(line)) == point["ldem_line"]
        assert round(float(sample)) == point["ldem_sample"]
        reference = point["pgda_mean_height_m"]
        ours.append(abs(point["ldem_dn"] * 0.5 - reference))
        mirrored.append(abs(point["ldem_mirrored_dn"] * 0.5 - reference))
        flipped.append(abs(point["ldem_flipped_dn"] * 0.5 - reference))
    assert max(ours) < 25.0  # metres; the two products differ in processing
    for alternative in (mirrored, flipped):
        assert float(np.median(alternative)) > 300.0
        assert max(alternative) > 1000.0
