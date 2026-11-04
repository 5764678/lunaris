"""T-21: Sun and Earth topocentric geometry (contract C2) — conventions, cross-checks,
pole rejection, vectorisation and performance."""

from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

import numpy as np
import pytest
import spiceypy

from lunaris_science.coordinates import CoordinateError, SelenographicCoordinate
from lunaris_science.geometry import (
    Body,
    EpochError,
    GeometryError,
    ObserverSite,
    body_geometry,
    enu_basis,
    topocentric_az_el,
    uniform_utc_grid,
    utc_to_et,
)
from lunaris_science.geometry.spice import SpiceContext
from lunaris_science.provenance import EvidenceKind

ARCSEC = 1.0 / 3600.0


def _site(lat: float, lon: float, height_m: float | None = None) -> ObserverSite:
    return ObserverSite(SelenographicCoordinate(lat, lon, height_m))


# ── Local frame conventions (C0), no kernels ───────────────────────────────


@pytest.mark.parametrize(("lat", "lon"), [(-89.5, 0.0), (-85.0, 222.7), (0.0, 90.0), (45.0, 300.0)])
def test_enu_basis_is_orthonormal_right_handed_and_radial(lat: float, lon: float) -> None:
    position = _site(lat, lon).position_moon_me_m
    basis = enu_basis(position)
    east, north, up = basis
    np.testing.assert_allclose(basis @ basis.T, np.eye(3), atol=1e-15)
    np.testing.assert_allclose(np.cross(east, north), up, atol=1e-15)
    np.testing.assert_allclose(up, position / np.linalg.norm(position), atol=1e-15)
    assert north[2] >= 0.0  # north points toward +Z (MOON_ME north pole)


def test_enu_basis_rejects_the_polar_axis() -> None:
    with pytest.raises(CoordinateError, match="polar axis"):
        enu_basis([0.0, 0.0, -1_737_400.0])


def test_azimuth_is_clockwise_from_north_and_elevation_is_above_the_plane() -> None:
    basis = enu_basis(_site(-60.0, 30.0).position_moon_me_m)
    east, north, up = basis
    vectors = np.stack([north, east, -north, -east, up, north + up, -east - 1e-17 * north])
    azimuth, elevation, range_m = topocentric_az_el(vectors * 1e6, basis)
    np.testing.assert_allclose(azimuth[:4], [0.0, 90.0, 180.0, 270.0], atol=1e-12)
    np.testing.assert_allclose(elevation[:5], [0, 0, 0, 0, 90.0], atol=1e-12)
    assert elevation[5] == pytest.approx(45.0, abs=1e-12)
    assert 0.0 <= azimuth[6] < 360.0
    np.testing.assert_allclose(range_m[:5], 1e6)


@pytest.mark.parametrize("lat", [-90.0, 90.0])
def test_observer_at_the_pole_is_rejected(lat: float) -> None:
    with pytest.raises(CoordinateError, match="undefined at latitude"):
        _site(lat, 0.0)


def test_observer_just_off_the_pole_is_accepted() -> None:
    site = _site(-89.999999, 123.0)
    assert enu_basis(site.position_moon_me_m).shape == (3, 3)


def test_observer_radius_and_height_assumptions() -> None:
    unknown = _site(-89.5, 0.0)
    assert unknown.radius_m == 1_737_400.0
    assert any("h = 0 m" in a for a in unknown.assumptions)
    known = ObserverSite(SelenographicCoordinate(-89.5, 0.0, 1250.0), observer_height_m=2.0)
    assert known.radius_m == 1_737_400.0 + 1250.0 + 2.0
    assert not any("h = 0 m" in a for a in known.assumptions)
    with pytest.raises(CoordinateError):
        ObserverSite(SelenographicCoordinate(-89.5, 0.0), observer_height_m=-1.0)


# ── Epoch grid and UTC → ET ─────────────────────────────────────────────────


def test_uniform_utc_grid_is_inclusive_of_the_end_when_it_falls_on_a_step() -> None:
    start = datetime(2026, 11, 4, tzinfo=UTC)
    grid = uniform_utc_grid(start, start + timedelta(days=1), 3600.0)
    assert len(grid) == 25
    assert grid[-1] == start + timedelta(days=1)
    assert len(uniform_utc_grid(start, start + timedelta(minutes=90), 3600.0)) == 2
    assert uniform_utc_grid(start, start, 60.0) == (start,)


def test_uniform_utc_grid_rejects_bad_input() -> None:
    start = datetime(2026, 11, 4, tzinfo=UTC)
    with pytest.raises(EpochError, match="timezone-aware"):
        uniform_utc_grid(datetime(2026, 11, 4), start, 60.0)  # noqa: DTZ001
    with pytest.raises(EpochError, match="earlier"):
        uniform_utc_grid(start, start - timedelta(seconds=1), 60.0)
    with pytest.raises(EpochError, match="positive"):
        uniform_utc_grid(start, start, 0.0)


def test_utc_to_et_handles_a_leap_second(spice_context: SpiceContext) -> None:
    """2016-12-31T23:59:60 was a leap second: one UTC minute across it lasts 61 SI seconds."""
    before = datetime(2016, 12, 31, 23, 59, tzinfo=UTC)
    ets = utc_to_et(spice_context, [before, before + timedelta(minutes=1)])
    assert ets[1] - ets[0] == pytest.approx(61.0, abs=1e-6)
    j2000 = utc_to_et(spice_context, [datetime(2000, 1, 1, 11, 58, 55, 816000, tzinfo=UTC)])
    assert j2000[0] == pytest.approx(0.0, abs=1e-3)


# ── Geometry with the real kernels ─────────────────────────────────────────


def _ets(context: SpiceContext, hours: int) -> np.ndarray:
    start = datetime(2026, 11, 4, tzinfo=UTC)
    return utc_to_et(context, uniform_utc_grid(start, start + timedelta(hours=hours), 3600.0))


def test_series_shapes_units_and_evidence(spice_context: SpiceContext) -> None:
    ets = _ets(spice_context, 24)
    for body, radius_deg, radius_m in (
        (Body.SUN, 0.267, 695_700_000.0),
        (Body.EARTH, 0.95, 6_378_136.6),
    ):
        series = body_geometry(spice_context, body, _site(-89.5, 0.0), ets)
        assert len(series) == 25
        assert series.direction_moon_me.shape == (25, 3)
        np.testing.assert_allclose(np.linalg.norm(series.direction_moon_me, axis=1), 1.0)
        assert series.body_radius_m == radius_m
        assert np.all((series.azimuth_deg >= 0.0) & (series.azimuth_deg < 360.0))
        assert series.angular_radius_deg.mean() == pytest.approx(radius_deg, rel=0.06)
        assert series.aberration_correction == "CN+S"
        assert series.evidence.kind is EvidenceKind.MODEL
        assert {s.source_id.split("/")[1] for s in series.evidence.sources} >= {
            "de440s.bsp",
            "moon_pa_de440_200625.bpc",
        }
        assert "MOON_ME_DE440_ME421" in (series.evidence.method or "")
    assert series.range_m.mean() == pytest.approx(3.9e8, rel=0.1)  # Earth–Moon distance


def test_direction_is_consistent_with_azimuth_and_elevation(spice_context: SpiceContext) -> None:
    site = _site(-85.3, 31.4, 120.0)
    series = body_geometry(spice_context, Body.SUN, site, _ets(spice_context, 6))
    east, north, up = enu_basis(site.position_moon_me_m)
    az = np.radians(series.azimuth_deg)
    el = np.radians(series.elevation_deg)
    expected = (
        np.cos(el)[:, None] * (np.sin(az)[:, None] * east + np.cos(az)[:, None] * north)
        + np.sin(el)[:, None] * up
    )
    np.testing.assert_allclose(series.direction_moon_me, expected, atol=1e-12)


@pytest.mark.parametrize(
    ("lat", "lon", "height_m"),
    [(-89.5, 0.0, None), (-89.9, 200.0, 1500.0), (-84.0, 137.0, -2000.0), (-60.0, 315.0, 0.0)],
)
@pytest.mark.parametrize("body", list(Body))
def test_cross_check_against_spice_azlcpo(
    spice_context: SpiceContext, lat: float, lon: float, height_m: float | None, body: Body
) -> None:
    """Independent method: CSPICE azlcpo (ELLIPSOID, clockwise azimuth, elevation positive up)."""
    site = _site(lat, lon, height_m)
    ets = _ets(spice_context, 48)[::6]
    series = body_geometry(spice_context, body, site, ets)
    with spice_context.session():
        reference = np.array(
            [
                spiceypy.azlcpo(
                    "ELLIPSOID",
                    body.value,
                    float(et),
                    "CN+S",
                    False,
                    True,
                    site.position_moon_me_m / 1000.0,
                    "MOON",
                    "MOON_ME",
                )[0][:3]
                for et in ets
            ]
        )
    np.testing.assert_allclose(series.range_m, reference[:, 0] * 1000.0, rtol=1e-12)
    d_az = (series.azimuth_deg - np.degrees(reference[:, 1]) + 180.0) % 360.0 - 180.0
    d_el = series.elevation_deg - np.degrees(reference[:, 2])
    assert np.max(np.abs(d_az * np.cos(np.radians(series.elevation_deg)))) < 1e-6 * ARCSEC
    assert np.max(np.abs(d_el)) < 1e-6 * ARCSEC


def test_epochs_outside_kernel_coverage_are_rejected(spice_context: SpiceContext) -> None:
    with pytest.raises(GeometryError, match="coverage"):
        body_geometry(
            spice_context, Body.SUN, _site(-89.5, 0.0), [spice_context.coverage.end_et_s + 1]
        )


def test_unsupported_correction_is_rejected(spice_context: SpiceContext) -> None:
    with pytest.raises(GeometryError, match="aberration"):
        body_geometry(
            spice_context, Body.SUN, _site(-89.5, 0.0), [0.0], aberration_correction="XCN"
        )


def test_one_year_hourly_for_sun_and_earth_takes_under_two_seconds(
    spice_context: SpiceContext,
) -> None:
    """Acceptance (T-21): 8 760 samples < 2 s. Timed for both bodies, including UTC → ET."""
    start = datetime(2026, 1, 1, tzinfo=UTC)
    site = _site(-89.45, 222.69)
    t0 = time.perf_counter()
    grid = uniform_utc_grid(start, start + timedelta(hours=8759), 3600.0)
    ets = utc_to_et(spice_context, grid)
    sun = body_geometry(spice_context, Body.SUN, site, ets)
    earth = body_geometry(spice_context, Body.EARTH, site, ets)
    elapsed = time.perf_counter() - t0
    assert len(sun) == len(earth) == 8760
    assert elapsed < 2.0, f"8 760 samples × 2 bodies took {elapsed:.2f} s"


def test_concurrent_callers_get_the_serial_results(spice_context: SpiceContext) -> None:
    """FastAPI runs sync endpoints in a thread pool; the lock must keep results exact."""
    ets = _ets(spice_context, 24)
    sites = [_site(-89.5 + 0.1 * i, 30.0 * i) for i in range(8)]
    serial = [body_geometry(spice_context, Body.EARTH, s, ets).elevation_deg for s in sites]
    with ThreadPoolExecutor(max_workers=8) as pool:
        parallel = list(
            pool.map(
                lambda s: body_geometry(spice_context, Body.EARTH, s, ets).elevation_deg, sites
            )
        )
    for a, b in zip(serial, parallel, strict=True):
        np.testing.assert_array_equal(a, b)
