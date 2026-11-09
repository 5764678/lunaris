"""T-26: Moon-centred apparent Sun direction and sub-solar point."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import numpy as np
import pytest
import spiceypy

from lunaris_science.coordinates import SelenographicCoordinate, spherical_to_cartesian
from lunaris_science.geometry import (
    Body,
    ObserverSite,
    body_geometry,
    moon_centred_direction,
    uniform_utc_grid,
    utc_to_et,
)
from lunaris_science.geometry.spice import SpiceContext
from lunaris_science.provenance import EvidenceKind

FIXTURE = (
    Path(__file__).resolve().parents[3]
    / "data/fixtures/validation/horizons-subsolar-moon-2026-11-04.json"
)
ARCSEC = 1.0 / 3600.0
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _ets(context: SpiceContext, hours: int, step_h: int = 1) -> np.ndarray:
    start = datetime(2026, 11, 4, tzinfo=UTC)
    return utc_to_et(
        context, uniform_utc_grid(start, start + timedelta(hours=hours), step_h * 3600.0)
    )


def test_matches_spkpos_from_the_moon_centre(spice_context: SpiceContext) -> None:
    ets = _ets(spice_context, 48, 6)
    series = moon_centred_direction(spice_context, Body.SUN, ets)
    with spice_context.session():
        reference = np.array(
            [spiceypy.spkpos("SUN", float(et), "MOON_ME", "CN+S", "MOON")[0] for et in ets]
        )
    np.testing.assert_allclose(
        series.range_m, np.linalg.norm(reference, axis=1) * 1000.0, rtol=1e-14
    )
    np.testing.assert_allclose(
        series.direction_moon_me,
        reference / np.linalg.norm(reference, axis=1)[:, None],
        atol=1e-15,
    )
    np.testing.assert_allclose(np.linalg.norm(series.direction_moon_me, axis=1), 1.0)
    assert series.evidence.kind is EvidenceKind.MODEL
    assert {s.source_id.split("/")[1] for s in series.evidence.sources} >= {"de440s.bsp"}


def test_subsolar_point_is_the_direction_on_the_sphere(spice_context: SpiceContext) -> None:
    series = moon_centred_direction(spice_context, Body.SUN, _ets(spice_context, 24))
    rebuilt = spherical_to_cartesian(
        series.subpoint_latitude_deg, series.subpoint_longitude_deg, 1.0
    )
    np.testing.assert_allclose(rebuilt, series.direction_moon_me, atol=1e-12)
    assert np.all((series.subpoint_longitude_deg >= 0) & (series.subpoint_longitude_deg < 360))
    assert series.angular_radius_deg.mean() == pytest.approx(0.267, rel=0.02)


def test_agrees_with_the_topocentric_direction_within_the_moon_radius_parallax(
    spice_context: SpiceContext,
) -> None:
    """Independent of the Moon-centred call: the T-21 site direction differs from it only by
    parallax, at most asin(R_moon / range) ≈ 2.4 arcsec for the Sun."""
    ets = _ets(spice_context, 24)
    centred = moon_centred_direction(spice_context, Body.SUN, ets)
    site = body_geometry(
        spice_context, Body.SUN, ObserverSite(SelenographicCoordinate(-89.5, 0.0, 0.0)), ets
    )
    cos = np.clip(np.sum(centred.direction_moon_me * site.direction_moon_me, axis=1), -1, 1)
    parallax = np.degrees(np.arccos(cos)) / ARCSEC
    bound = np.degrees(np.arcsin(1_737_400.0 / centred.range_m)) / ARCSEC
    assert np.all(parallax <= bound + 1e-3)
    assert parallax.max() > 0.5 * bound.max()  # a real offset, not the same call twice


def _horizons() -> list[tuple[datetime, float, float]]:
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    rows = []
    for line in fixture["soe_block_verbatim"].splitlines()[1:-1]:
        fields = [f.strip() for f in line.split(",")]
        date, clock = fields[0].split(" ")
        year, month, day = date.split("-")
        hour, minute = clock.split(":")
        epoch = datetime(
            int(year), MONTHS.index(month) + 1, int(day), int(hour), int(minute), tzinfo=UTC
        )
        rows.append((epoch, float(fields[3]), float(fields[4])))
    parsed = [
        (
            datetime.fromisoformat(s["time_utc"]),
            s["subsolar_longitude_deg"],
            s["subsolar_latitude_deg"],
        )
        for s in fixture["samples"]
    ]
    assert parsed == rows
    assert "Apparent sub-solar longitude and latitude" in fixture["definition_verbatim"]
    assert "Target pole/equ : MOON_ME" in "\n".join(fixture["header_verbatim"])
    return rows


def test_horizons_subsolar_point_same_definition(spice_context: SpiceContext) -> None:
    """Horizons evaluates the Moon as seen from the geocentre: at t − (Earth–Moon light
    time). Evaluated the same way, LUNARIS agrees to < 0.05 arcsec."""
    rows = _horizons()
    ets = utc_to_et(spice_context, [r[0] for r in rows])
    with spice_context.session():
        lts = np.array(
            [spiceypy.spkpos("MOON", float(et), "J2000", "LT", "EARTH")[1] for et in ets]
        )
    series = moon_centred_direction(spice_context, Body.SUN, ets - lts)
    for (_, lon, lat), mlon, mlat in zip(
        rows, series.subpoint_longitude_deg, series.subpoint_latitude_deg, strict=True
    ):
        d_lon = ((mlon - lon + 180.0) % 360.0 - 180.0) * np.cos(np.radians(lat))
        assert abs(d_lon) < 0.05 * ARCSEC
        assert abs(mlat - lat) < 0.05 * ARCSEC


def test_horizons_subsolar_point_at_the_request_epoch(spice_context: SpiceContext) -> None:
    """At t itself (what the endpoint returns), the 1.3 s light time moves the longitude by
    ≈ 0.64 arcsec (lunar rotation ≈ 0.55 arcsec/s): within 1 arcsec."""
    rows = _horizons()
    series = moon_centred_direction(
        spice_context, Body.SUN, utc_to_et(spice_context, [r[0] for r in rows])
    )
    for (_, lon, lat), mlon, mlat in zip(
        rows, series.subpoint_longitude_deg, series.subpoint_latitude_deg, strict=True
    ):
        d_lon = ((mlon - lon + 180.0) % 360.0 - 180.0) * np.cos(np.radians(lat))
        assert abs(d_lon) < 1.0 * ARCSEC
        assert abs(d_lon) > 0.5 * ARCSEC  # the light-time offset is real and explained
        assert abs(mlat - lat) < 0.05 * ARCSEC
