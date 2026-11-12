"""K-01: geocentric Moon phase series (contract L1) and its validation against JPL Horizons.

Fixture ``horizons-moon-phases-2027.json`` (built by ``fetch_horizons_moon_phases.py``)
holds, with the exact request parameters and the verbatim ``$$SOE…$$EOE`` blocks:

* apparent geocentric ecliptic longitudes **of date** of the Moon and the Sun, every
  minute around each 2027 principal phase. Horizons' own instant is found here as the
  zero of ``λ☾ − λ☉ − target`` by linear interpolation between minutes;
* illuminated fraction, sub-observer point, elongation (with its /T, /L flag) and phase
  angle every 6 h over January 2027.

Tolerances are stated and justified in docs/SCIENCE.md §5.2 ("Moon phase series").
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
import pytest
import spiceypy

from lunaris_science.geometry import Body, moon_centred_direction, utc_to_et
from lunaris_science.geometry.moon_phase import (
    PHASE_TARGET_DEG,
    PrincipalPhase,
    longitude_difference_deg,
    moon_phase_series,
    principal_phases,
)
from lunaris_science.geometry.spice import SpiceContext
from lunaris_science.provenance import EvidenceKind

FIXTURE = (
    Path(__file__).resolve().parents[3]
    / "data/fixtures/validation/horizons-moon-phases-2027.json"
)
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
ARCSEC = 1.0 / 3600.0

PHASE_INSTANT_TOLERANCE_S = 5.0
"""Measured max |Δ| 1.98 s over 49 events; omitting light time moves them by 33–45 s."""
ANGLE_TOLERANCE_DEG = 1e-4
"""Horizons prints phase angle and elongation to 1e-4°; measured max |Δ| 5.0e-5°."""
FRACTION_TOLERANCE = 1e-4
"""Measured max |Δ| 2.5e-5 (0.0025 percentage points)."""
SUBPOINT_SAME_CONVENTION_TOLERANCE_ARCSEC = 0.05
"""Horizons' convention (light time only) reproduced: measured max 0.005″."""
SUBPOINT_ABERRATION_BOUND_ARCSEC = 22.0
"""CN+S (L1) vs Horizons' light-time-only sub-observer point: stellar aberration, v/c ≈ 20.5″."""


def _parse(block: str) -> list[tuple[datetime, list[str]]]:
    lines = block.splitlines()
    assert lines[0] == "$$SOE"
    assert lines[-1] == "$$EOE"
    rows = []
    for line in lines[1:-1]:
        fields = [f.strip() for f in line.split(",")]
        year, month, rest = fields[0].split("-", 2)
        day, clock = rest.split()
        fmt = "%H:%M:%S.%f" if clock.count(":") == 2 else "%H:%M"
        stamp = datetime.strptime(
            f"{year}-{MONTHS.index(month) + 1:02d}-{day} {clock}", f"%Y-%m-%d {fmt}"
        ).replace(tzinfo=UTC)
        rows.append((stamp, [f for f in fields[3:] if f]))
    return rows


@pytest.fixture(scope="module")
def fixture() -> dict[str, Any]:
    payload: dict[str, Any] = json.loads(FIXTURE.read_text(encoding="utf-8"))
    return payload


def _horizons_instants(fixture: dict[str, Any]) -> list[tuple[PrincipalPhase, float]]:
    """Horizons' principal-phase instants (UTC POSIX seconds) from its of-date longitudes."""
    out = []
    for batch in fixture["longitudes"]:
        assert batch["moon"]["params"]["QUANTITIES"] == "'31'"
        assert batch["moon"]["params"]["CENTER"] == "'500@399'"
        moon, sun = _parse(batch["moon"]["block"]), _parse(batch["sun"]["block"])
        assert len(moon) == len(sun) == 12 * len(batch["events"])
        for k, name in enumerate(batch["events"]):
            phase = PrincipalPhase(name)
            rows = list(zip(moon[12 * k : 12 * k + 12], sun[12 * k : 12 * k + 12], strict=True))
            assert all(m[0] == s[0] for m, s in rows)
            t = np.array([m[0].timestamp() for m, _ in rows])
            d = np.array([(float(m[1][0]) - float(s[1][0])) % 360.0 for m, s in rows])
            offset = (d - PHASE_TARGET_DEG[phase] + 180.0) % 360.0 - 180.0
            (crossing,) = np.nonzero((offset[:-1] < 0) & (offset[1:] >= 0))[0]
            i = int(crossing)
            fraction = -offset[i] / (offset[i + 1] - offset[i])
            out.append((phase, float(t[i] + fraction * (t[i + 1] - t[i]))))
    return out


def _year_2027(context: SpiceContext) -> tuple[float, float]:
    ets = utc_to_et(context, [datetime(2027, 1, 1, tzinfo=UTC), datetime(2028, 1, 1, tzinfo=UTC)])
    return float(ets[0]), float(ets[1])


def _utc_seconds(context: SpiceContext, et: float) -> float:
    with context.session():
        iso = spiceypy.et2utc(et, "ISOC", 3)
    return datetime.fromisoformat(iso).replace(tzinfo=UTC).timestamp()


def test_2027_principal_phases_match_horizons(
    spice_context: SpiceContext, fixture: dict[str, Any]
) -> None:
    events = principal_phases(spice_context, *_year_2027(spice_context))
    reference = _horizons_instants(fixture)
    assert len(events) == len(reference) == 49
    assert [e.phase for e in events] == [phase for phase, _ in reference]
    differences = np.array(
        [
            _utc_seconds(spice_context, e.epoch_et_s) - t
            for e, (_, t) in zip(events, reference, strict=True)
        ]
    )
    assert np.max(np.abs(differences)) < PHASE_INSTANT_TOLERANCE_S, differences


def test_principal_phases_cycle_in_order(spice_context: SpiceContext) -> None:
    events = principal_phases(spice_context, *_year_2027(spice_context))
    order = list(PrincipalPhase)
    start = order.index(events[0].phase)
    assert [e.phase for e in events] == [order[(start + i) % 4] for i in range(len(events))]
    new_moons = np.array([e.epoch_et_s for e in events if e.phase is PrincipalPhase.NEW_MOON])
    synodic_days = np.diff(new_moons) / 86400.0
    assert np.all((synodic_days > 29.2) & (synodic_days < 29.9))  # synodic month varies
    for e in events:
        d = float(longitude_difference_deg(spice_context, [e.epoch_et_s])[0])
        assert (d - PHASE_TARGET_DEG[e.phase] + 180) % 360 - 180 == pytest.approx(0, abs=1e-5)


def _sample_rows(fixture: dict[str, Any]) -> list[tuple[datetime, list[str]]]:
    assert fixture["samples"]["params"]["QUANTITIES"] == "'10,14,23,24'"
    return _parse(fixture["samples"]["block"])


def test_phase_angle_fraction_elongation_and_waxing_match_horizons(
    spice_context: SpiceContext, fixture: dict[str, Any]
) -> None:
    rows = _sample_rows(fixture)
    series = moon_phase_series(spice_context, utc_to_et(spice_context, [r[0] for r in rows]))
    # Columns: Illu% | ObsSub-LON | ObsSub-LAT | S-O-T | /r | S-T-O
    illum = np.array([float(r[1][0]) for r in rows]) / 100.0
    elongation = np.array([float(r[1][3]) for r in rows])
    flag = np.array([r[1][4] for r in rows])
    phase = np.array([float(r[1][5]) for r in rows])
    assert np.max(np.abs(series.phase_angle_deg - phase)) < ANGLE_TOLERANCE_DEG
    assert np.max(np.abs(series.elongation_deg - elongation)) < ANGLE_TOLERANCE_DEG
    assert np.max(np.abs(series.illuminated_fraction - illum)) < FRACTION_TOLERANCE
    # Horizons: /T = target trails the Sun (evening sky) = waxing; /L = leads = waning.
    # Its flag is not defined on ecliptic longitude, so near new and full Moon (where the
    # Moon's ecliptic latitude can move the flip by hours) the two definitions may differ.
    # Those flip instants are validated against Horizons' of-date longitudes in
    # test_2027_principal_phases_match_horizons; here samples within 6° (≈ 12 h) of
    # D = 0° or 180° are left out. In this fixture that excludes one disagreement
    # (2027-01-22 12:00, 17 min before full Moon).
    assert set(flag) == {"/T", "/L"}
    d = series.longitude_difference_deg
    clear = np.minimum(np.abs(d - 180.0), np.minimum(d, 360.0 - d)) > 6.0
    assert clear.sum() > 100
    np.testing.assert_array_equal(series.waxing[clear], (flag == "/T")[clear])


def test_sub_earth_point_against_horizons(
    spice_context: SpiceContext, fixture: dict[str, Any]
) -> None:
    """Horizons' sub-observer point is the reversed geocentric Moon direction with light time
    only, in MOON_ME at t − lt. Reproduced that way to < 0.05″. The L1 value (CN+S from the
    Moon's centre, the Sun-series convention) differs only by stellar aberration (≲ 21″)."""
    rows = _sample_rows(fixture)
    lon_h = np.array([float(r[1][1]) for r in rows])
    lat_h = np.array([float(r[1][2]) for r in rows])
    ets = utc_to_et(spice_context, [r[0] for r in rows])
    same = []
    with spice_context.session():
        for et in ets:
            position, lt = spiceypy.spkpos("MOON", float(et), "J2000", "LT", "EARTH")
            rotation = np.asarray(spiceypy.pxform("J2000", "MOON_ME", float(et) - lt))
            _, lon, lat = spiceypy.reclat(-(rotation @ np.asarray(position)))
            same.append((np.degrees(lon) % 360.0, np.degrees(lat)))
    same_arr = np.array(same)

    def wrapped(a: np.ndarray, b: np.ndarray) -> np.ndarray:
        return np.asarray(np.abs((a - b + 180.0) % 360.0 - 180.0))

    assert np.max(wrapped(same_arr[:, 0], lon_h)) < SUBPOINT_SAME_CONVENTION_TOLERANCE_ARCSEC * (
        ARCSEC
    )
    assert np.max(np.abs(same_arr[:, 1] - lat_h)) < SUBPOINT_SAME_CONVENTION_TOLERANCE_ARCSEC * (
        ARCSEC
    )
    series = moon_phase_series(spice_context, ets)
    lon_l1 = series.earth.subpoint_longitude_deg
    lat_l1 = series.earth.subpoint_latitude_deg
    assert np.max(wrapped(lon_l1, lon_h)) < SUBPOINT_ABERRATION_BOUND_ARCSEC * ARCSEC
    assert np.max(np.abs(lat_l1 - lat_h)) < SUBPOINT_ABERRATION_BOUND_ARCSEC * ARCSEC
    # The difference is real (≈ 20″ near new and full Moon), not noise.
    assert np.max(wrapped(lon_l1, lon_h)) > 15.0 * ARCSEC


def test_series_is_internally_consistent(spice_context: SpiceContext) -> None:
    start = datetime(2027, 1, 1, tzinfo=UTC)
    ets = utc_to_et(spice_context, [start])[0] + 3600.0 * np.arange(24 * 30)
    series = moon_phase_series(spice_context, ets)
    np.testing.assert_allclose(
        series.illuminated_fraction, (1 + np.cos(np.radians(series.phase_angle_deg))) / 2
    )
    assert np.all((series.phase_angle_deg >= 0) & (series.phase_angle_deg <= 180))
    assert np.all((series.illuminated_fraction >= 0) & (series.illuminated_fraction <= 1))
    # Earth–Moon–Sun triangle: i + elongation + (Moon–Sun–Earth angle ≤ 0.15°) = 180°.
    assert np.all(np.abs(series.phase_angle_deg + series.elongation_deg - 180.0) < 0.2)
    np.testing.assert_array_equal(series.waxing, series.longitude_difference_deg < 180.0)
    # Earth direction is exactly the Moon-centred Earth direction of the Sun-series code.
    earth = moon_centred_direction(spice_context, Body.EARTH, ets)
    np.testing.assert_array_equal(series.earth.direction_moon_me, earth.direction_moon_me)
    np.testing.assert_allclose(np.linalg.norm(series.earth.direction_moon_me, axis=1), 1.0)
    assert np.all(np.abs(series.earth.subpoint_latitude_deg) < 8.0)  # libration in latitude
    assert series.evidence.kind is EvidenceKind.MODEL
    assert {s.source_id.split("/")[1] for s in series.evidence.sources} >= {"de440s.bsp"}
    assert "phaseq" in (series.evidence.method or "")
