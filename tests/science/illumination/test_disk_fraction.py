"""T-23: visible disk fraction against a horizon profile (D4).

All horizons here are synthetic, built inside the tests; they are not lunar data.
"""

from __future__ import annotations

import time

import numpy as np
import pytest

from lunaris_science.coordinates import SelenographicCoordinate
from lunaris_science.horizon_mask import HorizonMask
from lunaris_science.illumination import (
    ASTRONOMICAL_HORIZON,
    DiskFractionError,
    FlatHorizon,
    HorizonLike,
    straight_horizon_fraction,
    visible_disk_fraction,
)

SUN_R = 0.2689  # deg, typical apparent solar radius
EARTH_R = 0.95  # deg, typical apparent Earth radius


def _profile(elevation: np.ndarray, truncated: np.ndarray | None = None) -> HorizonMask:
    """A real C1 HorizonMask carrying a synthetic horizon (test data, not lunar data)."""
    n = elevation.size
    return HorizonMask(
        site=SelenographicCoordinate(-89.5, 0.0, 0.0),
        observer_height_m=0.0,
        surface_height_m=0.0,
        azimuth_deg=np.arange(n, dtype=np.float64) * (360.0 / n),
        elevation_deg=elevation,
        truncated=np.zeros(n, dtype=bool) if truncated is None else truncated,
        max_range_m=200_000.0,
        dem_source_id="synthetic-test-horizon",
        dem_sha256="0" * 64,
        dem_resolution_m=240.0,
        method="synthetic horizon built in the test (not lunar data)",
    )


def _constant(value: float, samples: int = 1440) -> HorizonMask:
    return _profile(np.full(samples, value))


# ── Acceptance: flat horizon ───────────────────────────────────────────────


@pytest.mark.parametrize("radius", [SUN_R, EARTH_R])
def test_flat_horizon_centre_on_it_gives_one_half(radius: float) -> None:
    result = visible_disk_fraction(123.4, 0.0, radius, ASTRONOMICAL_HORIZON)
    assert result.visible_fraction[0] == pytest.approx(0.5, abs=1e-12)


@pytest.mark.parametrize("radius", [SUN_R, EARTH_R])
def test_centre_at_plus_r_gives_one_and_minus_r_gives_zero(radius: float) -> None:
    flat = ASTRONOMICAL_HORIZON
    result = visible_disk_fraction([10.0, 10.0], [radius, -radius], radius, flat)
    assert result.visible_fraction[0] == 1.0
    assert result.visible_fraction[1] == 0.0
    far = visible_disk_fraction([0.0, 0.0], [5.0, -5.0], radius, flat)
    np.testing.assert_array_equal(far.visible_fraction, [1.0, 0.0])


@pytest.mark.parametrize("radius", [SUN_R, EARTH_R])
@pytest.mark.parametrize("horizon_deg", [0.0, 1.7, -2.3])
def test_intermediate_positions_match_the_circular_segment(
    radius: float, horizon_deg: float
) -> None:
    offsets = np.linspace(-1.2, 1.2, 241) * radius
    result = visible_disk_fraction(200.0, horizon_deg + offsets, radius, _constant(horizon_deg))
    expected = straight_horizon_fraction(offsets, radius)
    error = np.max(np.abs(result.visible_fraction - expected))
    assert error < 1e-3  # acceptance criterion
    assert error < 2e-5  # what the default 128 nodes actually achieve
    np.testing.assert_allclose(result.horizon_elevation_deg, horizon_deg)


def test_fully_visible_and_fully_hidden_are_exact_for_any_geometry() -> None:
    """Regression: summing the numerator and denominator differently gave 1 - 1 ulp, which
    undercounted 'fully visible' samples."""
    rng = np.random.default_rng(20261104)
    az = rng.uniform(0.0, 360.0, 500)
    radius = rng.uniform(0.2, 1.0, 500)
    up = visible_disk_fraction(
        az, radius + rng.uniform(0.0, 5.0, 500), radius, ASTRONOMICAL_HORIZON
    )
    down = visible_disk_fraction(
        az, -radius - rng.uniform(0.0, 5.0, 500), radius, ASTRONOMICAL_HORIZON
    )
    assert np.all(up.visible_fraction == 1.0)
    assert np.all(down.visible_fraction == 0.0)


def test_straight_horizon_formula_definitional_values() -> None:
    np.testing.assert_allclose(
        straight_horizon_fraction([-2.0, -1.0, 0.0, 1.0, 2.0], 1.0), [0, 0, 0.5, 1, 1], atol=1e-15
    )


def test_tilted_straight_horizon_matches_the_segment_at_the_line_distance() -> None:
    """Horizon linear in azimuth across the disk: H = H0 + k·(az − A). In the tangent plane
    that is a straight line of slope s = k / cos e, at distance (e − H0)/√(1 + s²)."""
    n = 3600
    az = np.arange(n) * 0.1
    k = 0.4  # deg of horizon per deg of azimuth near A
    centre_az, h0 = 180.0, 1.0
    elevation = h0 + k * (az - centre_az)  # exact linear section well beyond the disk
    profile = _profile(elevation)
    e = h0 + np.linspace(-0.4, 0.4, 81)
    result = visible_disk_fraction(centre_az, e, SUN_R, profile)
    slope = k / np.cos(np.radians(e))
    distance = (e - h0) / np.sqrt(1.0 + slope**2)
    expected = straight_horizon_fraction(distance, SUN_R)
    assert np.max(np.abs(result.visible_fraction - expected)) < 1e-3


# ── Acceptance: step-function horizons ─────────────────────────────────────


def _step_profile(step_az: float, low: float, high: float, resolution: float) -> HorizonMask:
    n = round(360.0 / resolution)
    az = np.arange(n) * resolution
    return _profile(np.where(az <= step_az, low, high))


def test_step_at_the_disk_centre_gives_the_mean_of_two_half_disks() -> None:
    """Left half above H = low, right half above H = high: f = (seg(d_low) + seg(d_high)) / 2."""
    resolution = 0.0005
    step_az = 90.0
    low, high = 0.0, 0.2
    profile = _step_profile(step_az, low, high, resolution)
    centre_az = step_az + resolution / 2.0  # midway through the one-sample transition
    elevations = np.linspace(-0.4, 0.6, 51)
    result = visible_disk_fraction(centre_az, elevations, SUN_R, profile)
    expected = 0.5 * (
        straight_horizon_fraction(elevations - low, SUN_R)
        + straight_horizon_fraction(elevations - high, SUN_R)
    )
    assert np.max(np.abs(result.visible_fraction - expected)) < 1e-3


def _grid_reference(centre_az: float, e: float, r: float, profile: HorizonMask) -> float:
    """Independent brute-force reference: area fraction on a dense tangent-plane grid."""
    m = 1201
    x, y = np.meshgrid(np.linspace(-r, r, m), np.linspace(-r, r, m))
    inside = x**2 + y**2 <= r**2
    horizon = profile.elevation_at(centre_az + x / np.cos(np.radians(e)))
    return float(np.sum(inside & (e + y > horizon)) / np.sum(inside))


@pytest.mark.parametrize("offset_fraction", [-0.7, -0.3, 0.45, 0.9])
@pytest.mark.parametrize("radius", [SUN_R, EARTH_R])
def test_off_centre_steps_match_a_brute_force_grid(offset_fraction: float, radius: float) -> None:
    resolution = 0.002
    step_az = 270.0
    profile = _step_profile(step_az, -0.1, 0.5, resolution)
    centre_az = step_az - offset_fraction * radius  # step at x = offset_fraction·r (cos e ≈ 1)
    for e in (-0.2, 0.15, 0.35):
        result = visible_disk_fraction(centre_az, e, radius, profile, nodes=512)
        reference = _grid_reference(centre_az, e, radius, profile)
        assert result.visible_fraction[0] == pytest.approx(reference, abs=3e-3)


def test_wraps_across_north() -> None:
    """A disk straddling azimuth 0/360 sees the horizon on both sides of the seam."""
    n = 3600
    az = np.arange(n) * 0.1
    elevation = np.where((az < 180.0), 0.3, -0.3)  # step at 0° (and 180°)
    profile = _profile(elevation)
    result = visible_disk_fraction([0.0, 359.99999], 0.0, SUN_R, profile, nodes=512)
    reference = _grid_reference(0.0, 0.0, SUN_R, profile)
    np.testing.assert_allclose(result.visible_fraction, reference, atol=3e-3)


# ── Truncation (C1) ────────────────────────────────────────────────────────


def test_truncation_within_the_disk_span_is_flagged() -> None:
    n = 1440  # 0.25° step
    truncated = np.zeros(n, dtype=bool)
    truncated[400] = True  # azimuth 100.0°
    profile = _profile(np.zeros(n), truncated)
    result = visible_disk_fraction([100.0, 100.2, 100.6, 99.4, 99.5, 250.0], 0.0, SUN_R, profile)
    np.testing.assert_array_equal(result.truncated, [True, True, False, False, True, False])
    # 99.5° ± 0.27° reaches 99.77°, interpolated between 99.75° and the truncated 100° sample.


def test_flat_astronomical_horizon_is_never_truncated() -> None:
    result = visible_disk_fraction(np.arange(0.0, 360.0, 7.0), 0.1, EARTH_R, ASTRONOMICAL_HORIZON)
    assert not result.truncated.any()


# ── Validation and performance ─────────────────────────────────────────────


def test_horizon_mask_and_flat_horizon_satisfy_the_protocol() -> None:
    assert isinstance(_constant(0.0), HorizonLike)
    assert isinstance(ASTRONOMICAL_HORIZON, HorizonLike)
    assert isinstance(FlatHorizon(), HorizonLike)


def test_flat_horizon_matches_a_zero_horizon_mask() -> None:
    az = np.linspace(0.0, 359.0, 37)
    el = np.linspace(-1.0, 1.0, 37)
    flat = visible_disk_fraction(az, el, EARTH_R, ASTRONOMICAL_HORIZON)
    mask = visible_disk_fraction(az, el, EARTH_R, _constant(0.0, samples=360))
    np.testing.assert_array_equal(flat.visible_fraction, mask.visible_fraction)
    assert not flat.truncated.any()
    np.testing.assert_array_equal(flat.horizon_elevation_deg, 0.0)


def test_input_validation() -> None:
    flat = ASTRONOMICAL_HORIZON
    with pytest.raises(DiskFractionError, match="positive"):
        visible_disk_fraction(0.0, 0.0, 0.0, flat)
    with pytest.raises(DiskFractionError, match="finite"):
        visible_disk_fraction(np.nan, 0.0, SUN_R, flat)
    with pytest.raises(DiskFractionError, match="tangent-plane"):
        visible_disk_fraction(0.0, 88.9, SUN_R, flat)


def test_one_year_hourly_is_fast() -> None:
    profile = _profile(np.sin(np.radians(np.arange(1440) * 0.25 * 7)) * 1.5)
    az = np.linspace(0.0, 360.0 * 12, 8760) % 360.0
    el = 1.5 * np.sin(np.linspace(0.0, 2 * np.pi * 13, 8760))
    t0 = time.perf_counter()
    result = visible_disk_fraction(az, el, SUN_R, profile)
    assert time.perf_counter() - t0 < 1.0
    assert result.visible_fraction.shape == (8760,)
    assert np.all((result.visible_fraction >= 0.0) & (result.visible_fraction <= 1.0))
