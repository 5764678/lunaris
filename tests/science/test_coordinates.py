"""Coordinate primitives: definitional geometry checks with exact expected values."""

from __future__ import annotations

import math

import numpy as np
import pytest
from hypothesis import given
from hypothesis import strategies as st

from lunaris_science.constants import LOLA_REFERENCE_SPHERE_RADIUS
from lunaris_science.coordinates import (
    CoordinateError,
    SelenographicCoordinate,
    cartesian_to_spherical,
    normalize_east_longitude_deg,
    spherical_to_cartesian,
    to_signed_longitude_deg,
    validate_latitude_deg,
)
from lunaris_science.frames import LunarFrame

R = LOLA_REFERENCE_SPHERE_RADIUS.value


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (0.0, 0.0),
        (-0.0, 0.0),
        (360.0, 0.0),
        (720.0, 0.0),
        (-90.0, 270.0),
        (-180.0, 180.0),
        (180.0, 180.0),
        (359.999, 359.999),
        (-1e-17, 0.0),  # would round to exactly 360.0 without folding
        (450.5, 90.5),
    ],
)
def test_normalize_east_longitude(value: float, expected: float) -> None:
    result = normalize_east_longitude_deg(value)
    assert result == pytest.approx(expected, abs=1e-12)
    assert 0.0 <= result < 360.0
    assert math.copysign(1.0, result) == 1.0  # never -0.0


@pytest.mark.parametrize("bad", [math.nan, math.inf, -math.inf])
def test_non_finite_longitude_rejected(bad: float) -> None:
    with pytest.raises(CoordinateError):
        normalize_east_longitude_deg(bad)


@pytest.mark.parametrize(("value", "expected"), [(270.0, -90.0), (180.0, 180.0), (90.0, 90.0)])
def test_signed_longitude(value: float, expected: float) -> None:
    assert to_signed_longitude_deg(value) == expected


@pytest.mark.parametrize("bad", [90.0000001, -90.0000001, 180.0, math.nan])
def test_latitude_domain(bad: float) -> None:
    with pytest.raises(CoordinateError):
        validate_latitude_deg(bad)


def test_selenographic_coordinate_normalizes_and_defaults() -> None:
    c = SelenographicCoordinate(latitude_deg=-89.5, longitude_deg=-45.0)
    assert c.longitude_deg == 315.0
    assert c.height_m is None  # unknown height is not silently 0
    assert c.frame is LunarFrame.MOON_ME


def test_selenographic_coordinate_rejects_bad_height() -> None:
    with pytest.raises(CoordinateError):
        SelenographicCoordinate(latitude_deg=0.0, longitude_deg=0.0, height_m=math.inf)


@pytest.mark.parametrize(
    ("lat", "lon", "expected"),
    [
        (0.0, 0.0, (R, 0.0, 0.0)),  # prime meridian: +X (toward mean Earth)
        (0.0, 90.0, (0.0, R, 0.0)),  # 90° E: +Y
        (0.0, 180.0, (-R, 0.0, 0.0)),
        (0.0, 270.0, (0.0, -R, 0.0)),
        (90.0, 0.0, (0.0, 0.0, R)),  # north pole: +Z
        (-90.0, 123.0, (0.0, 0.0, -R)),  # south pole independent of longitude
    ],
)
def test_spherical_to_cartesian_axes(
    lat: float, lon: float, expected: tuple[float, float, float]
) -> None:
    xyz = spherical_to_cartesian(lat, lon, R)
    np.testing.assert_allclose(xyz, expected, atol=1e-6)


def test_spherical_to_cartesian_broadcasts() -> None:
    lats = np.array([[0.0, 45.0], [-45.0, -90.0]])
    xyz = spherical_to_cartesian(lats, 30.0, R)
    assert xyz.shape == (2, 2, 3)
    np.testing.assert_allclose(np.linalg.norm(xyz, axis=-1), R, rtol=1e-15)


def test_spherical_to_cartesian_validates() -> None:
    with pytest.raises(CoordinateError):
        spherical_to_cartesian(91.0, 0.0, R)
    with pytest.raises(CoordinateError):
        spherical_to_cartesian(0.0, 0.0, -1.0)
    with pytest.raises(CoordinateError):
        spherical_to_cartesian(0.0, math.nan, R)


def test_cartesian_to_spherical_rejects_origin_and_shape() -> None:
    with pytest.raises(CoordinateError):
        cartesian_to_spherical([0.0, 0.0, 0.0])
    with pytest.raises(CoordinateError):
        cartesian_to_spherical([1.0, 2.0])


def test_near_pole_latitude_is_well_conditioned() -> None:
    # 1 mm from the south pole on the reference sphere: asin(z/r) would lose precision.
    offset = 1e-3
    lat, _, _ = cartesian_to_spherical([offset, 0.0, -R])
    expected = -90.0 + math.degrees(math.atan2(offset, R))
    assert float(lat) == pytest.approx(expected, abs=1e-12)


@given(
    lat=st.floats(min_value=-89.999, max_value=89.999),
    lon=st.floats(min_value=0.0, max_value=359.999),
    radius=st.floats(min_value=1.0, max_value=1e7),
)
def test_round_trip(lat: float, lon: float, radius: float) -> None:
    xyz = spherical_to_cartesian(lat, lon, radius)
    lat2, lon2, radius2 = cartesian_to_spherical(xyz)
    assert float(lat2) == pytest.approx(lat, abs=1e-9)
    # compare longitudes on the circle
    delta = (float(lon2) - lon + 180.0) % 360.0 - 180.0
    assert abs(delta) < 1e-8
    assert float(radius2) == pytest.approx(radius, rel=1e-12)
