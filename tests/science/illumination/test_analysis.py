"""T-24: body timelines against astronomical and terrain horizons; Earth line of sight.

Synthetic geometry and horizons are built inside the tests (not lunar data); the last
tests use the real kernels for the 2026-11-04 Horizons fixture day.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import numpy as np
import pytest

from lunaris_science.coordinates import SelenographicCoordinate
from lunaris_science.geometry import (
    Body,
    BodyGeometrySeries,
    ObserverSite,
    body_geometry,
    uniform_utc_grid,
    utc_to_et,
)
from lunaris_science.geometry.spice import SpiceContext
from lunaris_science.horizon_mask import HorizonMask
from lunaris_science.illumination.analysis import HorizonKind, body_timeline
from lunaris_science.illumination.disk_fraction import straight_horizon_fraction
from lunaris_science.provenance import Evidence, EvidenceKind, SourceReference
from lunaris_science.visibility import (
    RADIO_LINK_DISCLAIMER,
    EarthLineOfSight,
    classify_line_of_sight,
)

STEP = 3600.0
SITE = SelenographicCoordinate(-89.5, 0.0, 0.0)


def _geometry(
    body: Body, elevation: np.ndarray, radius: float, azimuth: float = 120.0
) -> BodyGeometrySeries:
    n = elevation.size
    return BodyGeometrySeries(
        body=body,
        epochs_et_s=np.arange(n) * STEP,
        azimuth_deg=np.full(n, azimuth),
        elevation_deg=elevation,
        range_m=np.full(n, 1.5e11),
        angular_radius_deg=np.full(n, radius),
        direction_moon_me=np.tile([1.0, 0.0, 0.0], (n, 1)),
        body_radius_m=695_700_000.0,
        body_radii_m=(695_700_000.0,) * 3,
        observer=ObserverSite(SITE),
        aberration_correction="CN+S",
        evidence=Evidence(
            kind=EvidenceKind.MODEL,
            statement="synthetic geometry (test only)",
            sources=(
                SourceReference(source_id="test/kernel", title="test kernel", sha256="1" * 64),
            ),
            method="synthetic",
        ),
    )


def _mask(
    elevation: float | np.ndarray, truncated: np.ndarray | None = None, n: int = 1440
) -> HorizonMask:
    values = np.broadcast_to(np.asarray(elevation, dtype=np.float64), (n,)).copy()
    return HorizonMask(
        site=SITE,
        observer_height_m=2.0,
        surface_height_m=0.0,
        azimuth_deg=np.arange(n, dtype=np.float64) * (360.0 / n),
        elevation_deg=values,
        truncated=np.zeros(n, dtype=bool) if truncated is None else truncated,
        max_range_m=200_000.0,
        dem_source_id="synthetic-test-dem",
        dem_sha256="2" * 64,
        dem_resolution_m=240.0,
        method="synthetic horizon built in the test (not lunar data)",
    )


def test_astronomical_and_terrain_are_reported_separately() -> None:
    elevation = np.linspace(-1.0, 1.5, 51)
    geometry = _geometry(Body.SUN, elevation, 0.27)
    timeline = body_timeline(geometry, _mask(0.5))
    assert timeline.astronomical.horizon is HorizonKind.ASTRONOMICAL
    assert timeline.terrain is not None
    assert timeline.terrain.horizon is HorizonKind.TERRAIN
    np.testing.assert_allclose(
        timeline.astronomical.disk.visible_fraction,
        straight_horizon_fraction(elevation, 0.27),
        atol=2e-5,
    )
    np.testing.assert_allclose(
        timeline.terrain.disk.visible_fraction,
        straight_horizon_fraction(elevation - 0.5, 0.27),
        atol=2e-5,
    )
    assert (
        timeline.terrain.summary.mean_visible_disk_fraction
        < timeline.astronomical.summary.mean_visible_disk_fraction
    )
    assert timeline.evidence.kind is EvidenceKind.CALCULATION
    source_ids = {s.source_id for s in timeline.evidence.sources}
    assert source_ids == {"test/kernel", "synthetic-test-dem/horizon-mask-dem"}
    assert any("2 m above the DEM surface" in a for a in timeline.evidence.assumptions)


def test_without_a_mask_only_the_astronomical_horizon_is_reported_and_said_so() -> None:
    timeline = body_timeline(_geometry(Body.SUN, np.zeros(10), 0.27))
    assert timeline.terrain is None
    assert any("Terrain horizon not available" in item for item in timeline.limitations)


def test_truncation_is_surfaced_with_a_count() -> None:
    truncated = np.zeros(1440, dtype=bool)
    truncated[480] = True  # azimuth 120°: where the synthetic body sits
    timeline = body_timeline(_geometry(Body.SUN, np.zeros(6), 0.27), _mask(0.0, truncated))
    assert timeline.terrain is not None
    assert timeline.terrain.summary.any_truncated
    assert any("6 of 6 samples" in item and "upper bound" in item for item in timeline.limitations)
    assert not timeline.astronomical.summary.any_truncated


def test_earth_results_carry_the_radio_link_disclaimer_and_sun_results_do_not() -> None:
    earth = body_timeline(_geometry(Body.EARTH, np.zeros(4), 0.95))
    sun = body_timeline(_geometry(Body.SUN, np.zeros(4), 0.27))
    assert earth.limitations[0] == RADIO_LINK_DISCLAIMER
    assert RADIO_LINK_DISCLAIMER not in sun.limitations


def test_line_of_sight_classification() -> None:
    astro = np.array([0.0, 0.4, 0.4, 0.0, 1.0])
    terrain = np.array([0.0, 0.0, 0.2, 0.3, 1.0])  # index 3: seen from a peak, below 0°
    states = classify_line_of_sight(astro, terrain)
    assert list(states) == [
        EarthLineOfSight.BELOW_GEOMETRIC_HORIZON,
        EarthLineOfSight.TERRAIN_OBSTRUCTED,
        EarthLineOfSight.CLEAR,
        EarthLineOfSight.CLEAR,
        EarthLineOfSight.CLEAR,
    ]
    assert list(classify_line_of_sight(astro)) == [
        EarthLineOfSight.BELOW_GEOMETRIC_HORIZON,
        EarthLineOfSight.CLEAR,
        EarthLineOfSight.CLEAR,
        EarthLineOfSight.BELOW_GEOMETRIC_HORIZON,
        EarthLineOfSight.CLEAR,
    ]


def test_fixture_day_with_real_kernels(spice_context: SpiceContext) -> None:
    """2026-11-04 at 89.5° S, 0° E: Sun elevation 1.22°–1.30° (disk fully up, r ≈ 0.27°);
    Earth elevation −1.16° … −2.61° (disk fully down, r ≈ 0.95°)."""
    start = datetime(2026, 11, 4, tzinfo=UTC)
    ets = utc_to_et(spice_context, uniform_utc_grid(start, start + timedelta(days=1), STEP))
    observer = ObserverSite(SITE)
    sun = body_timeline(body_geometry(spice_context, Body.SUN, observer, ets))
    earth = body_timeline(body_geometry(spice_context, Body.EARTH, observer, ets))
    assert sun.astronomical.summary.mean_visible_disk_fraction == 1.0
    assert sun.astronomical.summary.fully_visible_fraction == 1.0
    # Durations are ET differences (SI seconds): microsecond float noise at ET ≈ 8.5e8 s.
    assert sun.astronomical.summary.longest_visible.duration_s == pytest.approx(25 * STEP, abs=1e-3)
    assert sun.astronomical.summary.longest_visible.censored
    assert earth.astronomical.summary.illuminated_fraction == 0.0
    assert earth.astronomical.summary.longest_hidden.censored
    states = classify_line_of_sight(earth.astronomical.disk.visible_fraction)
    assert set(states) == {EarthLineOfSight.BELOW_GEOMETRIC_HORIZON}
