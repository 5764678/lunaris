"""T-21: validation against JPL Horizons (D2, docs/SCIENCE.md §5.2).

Fixtures: 25 hourly samples for the Sun and the Earth from a site at 89.5° S, 0° E,
h = 0 on the 1737.4 km sphere, 2026-11-04 00:00 → 11-05 00:00 UTC. Each fixture stores
the exact request URL and the verbatim ``$$SOE…$$EOE`` block; the parsed samples are
re-derived from that block here, so a transcription error cannot hide.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlsplit

import numpy as np
import pytest

from lunaris_science.coordinates import SelenographicCoordinate
from lunaris_science.geometry import Body, ObserverSite, body_geometry, utc_to_et
from lunaris_science.geometry.spice import SpiceContext

FIXTURES = Path(__file__).resolve().parents[3] / "data" / "fixtures" / "validation"
TOLERANCE_ARCSEC = 0.01
"""Stated and justified in docs/SCIENCE.md §5.2."""

CASES = {
    Body.SUN: ("horizons-sun-s89p5-e0-2026-11-04.json", "'10'"),
    Body.EARTH: ("horizons-earth-s89p5-e0-2026-11-04.json", "'399'"),
}
EXPECTED_QUERY = {
    "format": "text",
    "OBJ_DATA": "'NO'",
    "MAKE_EPHEM": "'YES'",
    "EPHEM_TYPE": "'OBSERVER'",
    "CENTER": "'coord@301'",
    "COORD_TYPE": "'GEODETIC'",
    "SITE_COORD": "'0,-89.5,0'",
    "START_TIME": "'2026-11-04 00:00'",
    "STOP_TIME": "'2026-11-05 00:00'",
    "STEP_SIZE": "'1 h'",
    "QUANTITIES": "'4'",
    "CSV_FORMAT": "'YES'",
    "ANG_FORMAT": "'DEG'",
    "EXTRA_PREC": "'YES'",
}
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _load(body: Body) -> dict[str, Any]:
    payload: dict[str, Any] = json.loads((FIXTURES / CASES[body][0]).read_text(encoding="utf-8"))
    return payload


def _parse_soe_block(block: str) -> list[tuple[datetime, float, float]]:
    lines = block.splitlines()
    assert lines[0] == "$$SOE"
    assert lines[-1] == "$$EOE"
    rows = []
    for line in lines[1:-1]:
        fields = [f.strip() for f in line.split(",")]
        date, clock = fields[0].split(" ")
        year, month, day = date.split("-")
        hour, minute = clock.split(":")
        epoch = datetime(
            int(year), MONTHS.index(month) + 1, int(day), int(hour), int(minute), tzinfo=UTC
        )
        rows.append((epoch, float(fields[3]), float(fields[4])))
    return rows


@pytest.mark.parametrize("body", list(Body))
def test_fixture_records_the_exact_request_and_the_verbatim_table(body: Body) -> None:
    fixture = _load(body)
    query = dict(parse_qsl(urlsplit(fixture["source"]["request_url"]).query))
    assert query == {**EXPECTED_QUERY, "COMMAND": CASES[body][1]}
    assert fixture["source"]["query"] == query
    assert fixture["source"]["api_url"] == "https://ssd.jpl.nasa.gov/api/horizons.api"
    assert "blocked" not in json.dumps(fixture["source"])

    rows = _parse_soe_block(fixture["soe_block_verbatim"])
    start = datetime(2026, 11, 4, tzinfo=UTC)
    assert [r[0] for r in rows] == [start + timedelta(hours=h) for h in range(25)]
    parsed = [
        (datetime.fromisoformat(s["time_utc"]), s["azimuth_deg"], s["elevation_deg"])
        for s in fixture["samples"]
    ]
    assert parsed == rows
    header = "\n".join(fixture["header_verbatim"])
    assert "Center pole/equ : MEAN_ME" in header
    assert "Center radii    : 1737.4, 1737.4, 1737.4 km" in header
    assert "Center geodetic : 0.0, -89.5, 0.0" in header
    assert fixture["comparison"]["tolerance_arcsec"] == TOLERANCE_ARCSEC


@pytest.mark.parametrize("body", list(Body))
def test_spice_geometry_reproduces_horizons(spice_context: SpiceContext, body: Body) -> None:
    fixture = _load(body)
    rows = _parse_soe_block(fixture["soe_block_verbatim"])
    observer = ObserverSite(SelenographicCoordinate(-89.5, 0.0, 0.0))
    ets = utc_to_et(spice_context, [r[0] for r in rows])
    series = body_geometry(spice_context, body, observer, ets)

    horizons_az = np.array([r[1] for r in rows])
    horizons_el = np.array([r[2] for r in rows])
    d_az_arcsec = ((series.azimuth_deg - horizons_az + 180.0) % 360.0 - 180.0) * 3600.0
    d_az_arcsec *= np.cos(np.radians(horizons_el))
    d_el_arcsec = (series.elevation_deg - horizons_el) * 3600.0
    assert np.max(np.abs(d_az_arcsec)) < TOLERANCE_ARCSEC, d_az_arcsec
    assert np.max(np.abs(d_el_arcsec)) < TOLERANCE_ARCSEC, d_el_arcsec


def test_earth_is_below_the_astronomical_horizon_on_the_fixture_day(
    spice_context: SpiceContext,
) -> None:
    """TD check (2026-11-04): Earth elevation −1.16° … −2.61° at this site on this day."""
    rows = _parse_soe_block(_load(Body.EARTH)["soe_block_verbatim"])
    observer = ObserverSite(SelenographicCoordinate(-89.5, 0.0, 0.0))
    series = body_geometry(
        spice_context, Body.EARTH, observer, utc_to_et(spice_context, [r[0] for r in rows])
    )
    assert series.elevation_deg.max() == pytest.approx(-1.162, abs=1e-3)
    assert series.elevation_deg.min() == pytest.approx(-2.607, abs=1e-3)
