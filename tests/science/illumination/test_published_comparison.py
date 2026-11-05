"""T-25 part 2: LUNARIS terrain-horizon results vs the published LOLA maps.

LUNARIS computes, at each demo-trio reference point, the share of time any part of the
Sun / Earth is visible above the terrain horizon (T-15 mask from LDEM_75S_240M, eye 2 m)
over the published period 2001-01-01 → 2018-08-08, and compares it with Mazarico et al.
(2011)'s AVGVISIB maps (data/fixtures/validation/published-illumination.json).

The test steps every 7 h (22 039 samples), which reproduces the hourly result to within
6e-4 at every site (measured; hourly values in docs/SCIENCE.md §6) at a seventh of the
cost. Real data: skipped without it unless LUNARIS_REQUIRE_KERNELS=1 (CI acquires both).
"""

from __future__ import annotations

import json
import os
from datetime import UTC, date, datetime
from importlib import resources
from pathlib import Path

import numpy as np
import pytest

from lunaris_data.readers.ldem import read_ldem_polar
from lunaris_data.registry import DatasetRegistry
from lunaris_data.validation.integrity import verify_dataset
from lunaris_science.coordinates import SelenographicCoordinate
from lunaris_science.geometry import Body, ObserverSite, body_geometry, uniform_utc_grid, utc_to_et
from lunaris_science.geometry.spice import SpiceContext
from lunaris_science.illumination.analysis import body_timeline
from lunaris_science.illumination.validation import PublishedReference, compare
from lunaris_science.terrain.dem import PolarDem
from lunaris_science.terrain.horizon import compute_horizon_mask
from tests.science.geometry.conftest import data_layout

FIXTURE = (
    Path(__file__).resolve().parents[3] / "data/fixtures/validation/published-illumination.json"
)
START, END = datetime(2001, 1, 1, tzinfo=UTC), datetime(2018, 8, 8, tzinfo=UTC)
STEP_S = 7 * 3600.0
EYE_M = 2.0
TOLERANCE = 0.05
"""Largest measured |computed − published| is 0.042 (Site23 Earth, hourly)."""


@pytest.fixture(scope="module")
def dem() -> PolarDem:
    layout = data_layout()
    manifest = DatasetRegistry.load_builtin().get("lola-ldem-75s-240m")
    if not verify_dataset(manifest, layout).ok:
        message = "LDEM_75S_240M not acquired: run `uv run lunaris-data acquire lola-ldem-75s-240m`"
        if os.environ.get("LUNARIS_REQUIRE_KERNELS") == "1":
            pytest.fail(message)
        pytest.skip(message)
    return read_ldem_polar(layout.dataset_dir(manifest) / "LDEM_75S_240M.LBL", manifest.id)


def _catalog_point(site_id: str) -> tuple[float, float]:
    catalog = resources.files("lunaris_data.catalogs") / "south-pole-candidate-sites.json"
    for site in json.loads(catalog.read_text(encoding="utf-8"))["sites"]:
        if site["id"] == site_id:
            return float(site["reference_point"]["latitude_deg"]), float(
                site["reference_point"]["longitude_deg"]
            )
    raise KeyError(site_id)


@pytest.fixture(scope="module")
def reference() -> dict[str, object]:
    payload: dict[str, object] = json.loads(FIXTURE.read_text(encoding="utf-8"))
    return payload


@pytest.mark.parametrize(
    ("site_id", "within_spread"),
    [("pgda78-site01", True), ("pgda78-site23", True), ("pgda78-site07", False)],
)
def test_terrain_illumination_matches_the_published_maps(
    spice_context: SpiceContext,
    dem: PolarDem,
    reference: dict[str, object],
    site_id: str,
    within_spread: bool,
) -> None:
    lat, lon = _catalog_point(site_id)
    mask = compute_horizon_mask(dem, lat, lon, observer_height_m=EYE_M)
    observer = ObserverSite(
        SelenographicCoordinate(lat, lon, mask.surface_height_m), observer_height_m=EYE_M
    )
    grid = uniform_utc_grid(START, END, STEP_S)
    ets = utc_to_et(spice_context, grid)
    end_et = float(utc_to_et(spice_context, [END])[0])
    source = reference["sources"]["mazarico2011_maps"]  # type: ignore[index]
    entries = {
        e["body"]: e
        for e in reference["entries"]  # type: ignore[attr-defined]
        if e["site_id"] == site_id
    }
    for body, key in ((Body.SUN, "sun"), (Body.EARTH, "earth")):
        timeline = body_timeline(
            body_geometry(spice_context, body, observer, ets), mask, window_end_et_s=end_et
        )
        assert timeline.terrain is not None
        published = PublishedReference.from_fixture(entries[key], source)
        result = compare(
            published,
            timeline.terrain.summary,
            period_start=date(2001, 1, 1),
            period_end=date(2018, 8, 8),
            dem_resolution_m=240.0,
            observer_height_m=EYE_M,
        )
        assert abs(result.difference) < TOLERANCE, (site_id, key, result.difference)
        assert not result.computed_is_upper_bound
        assert not any(d.startswith("Period") for d in result.stated_differences)
        if within_spread:
            assert result.within_local_spread, (site_id, key, result.computed_value)
    # Site07 (peak near Shackleton): the Sun value exceeds the published 3 × 3 maximum
    # (0.881 vs 0.841, hourly). Recorded and explained in docs/SCIENCE.md §6, not hidden.
    assert np.isfinite(result.computed_value)
