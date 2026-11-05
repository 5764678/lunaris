"""Terrain-horizon physical acceptance checks (TD, mask wiring after T-15).

Real data: LDEM_75S_240M (checksum-verified) through T-15's horizon computation and
the NAIF kernels; one year (2026) at a 1 h step. Masks come from S-TERRAIN's
``HorizonMaskService`` (T-16), the same path the API uses. Skipped without the data unless
``LUNARIS_REQUIRE_KERNELS=1``, under which CI acquires both datasets.
"""

from __future__ import annotations

import json
import os
from datetime import UTC, datetime, timedelta
from importlib import resources

import numpy as np
import pytest

from lunaris_api.services.horizon import HorizonMaskService
from lunaris_data.registry import DatasetRegistry
from lunaris_data.store import DataLayout
from lunaris_data.validation.integrity import verify_dataset
from lunaris_science.coordinates import SelenographicCoordinate
from lunaris_science.geometry import Body, ObserverSite, body_geometry, uniform_utc_grid, utc_to_et
from lunaris_science.geometry.spice import SpiceContext
from lunaris_science.horizon_mask import HorizonMask
from lunaris_science.illumination.analysis import BodyTimeline, body_timeline
from tests.science.geometry.conftest import data_layout

SHACKLETON_FLOOR = (-89.67, 129.2)
DEMO_TRIO = ("pgda78-site01", "pgda78-site23", "pgda78-site07")


@pytest.fixture(scope="module")
def masks(tmp_path_factory: pytest.TempPathFactory) -> HorizonMaskService:
    """S-TERRAIN's file-cached HorizonMaskService on a temporary data root that links the
    verified LDEM_75S_240M (the cache is written there, not into the repository)."""
    source = data_layout()
    registry = DatasetRegistry.load_builtin()
    manifest = registry.get("lola-ldem-75s-240m")
    if not verify_dataset(manifest, source).ok:
        message = (
            "LDEM_75S_240M not acquired/verified: "
            "run `uv run lunaris-data acquire lola-ldem-75s-240m`"
        )
        if os.environ.get("LUNARIS_REQUIRE_KERNELS") == "1":
            pytest.fail(message)
        pytest.skip(message)
    layout = DataLayout.from_root(tmp_path_factory.mktemp("data"))
    target = layout.dataset_dir(manifest)
    target.parent.mkdir(parents=True)
    target.symlink_to(source.dataset_dir(manifest), target_is_directory=True)
    return HorizonMaskService(registry, layout, sites=None)  # type: ignore[arg-type]


def _mask_at(masks: HorizonMaskService, latitude_deg: float, longitude_deg: float) -> HorizonMask:
    return masks.get_mask(latitude_deg=latitude_deg, longitude_deg=longitude_deg)


def _year_ets(context: SpiceContext) -> np.ndarray:
    start = datetime(2026, 1, 1, tzinfo=UTC)
    return utc_to_et(context, uniform_utc_grid(start, start + timedelta(days=365), 3600.0))


def _timeline(
    context: SpiceContext, mask: HorizonMask, body: Body, ets: np.ndarray
) -> BodyTimeline:
    observer = ObserverSite(
        SelenographicCoordinate(
            mask.site.latitude_deg, mask.site.longitude_deg, mask.surface_height_m
        ),
        observer_height_m=mask.observer_height_m,
    )
    return body_timeline(body_geometry(context, body, observer, ets), mask)


def test_shackleton_floor_is_never_lit_by_terrain_but_is_astronomically(
    spice_context: SpiceContext, masks: HorizonMaskService
) -> None:
    mask = _mask_at(masks, *SHACKLETON_FLOOR)
    assert mask.observer_height_m == 2.0
    assert mask.elevation_deg.min() >= 19.7  # crater wall all round
    sun = _timeline(spice_context, mask, Body.SUN, _year_ets(spice_context))
    assert sun.terrain is not None
    assert sun.terrain.summary.illuminated_fraction == 0.0
    assert sun.terrain.summary.longest_visible.duration_s == 0.0
    assert sun.astronomical.summary.illuminated_fraction > 0.0


def _catalog_point(site_id: str) -> tuple[float, float]:
    catalog = resources.files("lunaris_data.catalogs") / "south-pole-candidate-sites.json"
    for site in json.loads(catalog.read_text(encoding="utf-8"))["sites"]:
        if site["id"] == site_id:
            point = site["reference_point"]
            return float(point["latitude_deg"]), float(point["longitude_deg"])
    raise KeyError(site_id)


@pytest.mark.parametrize("site_id", list(DEMO_TRIO))
@pytest.mark.parametrize("body", list(Body))
def test_terrain_fraction_never_exceeds_astronomical_where_the_horizon_is_above_zero(
    spice_context: SpiceContext, masks: HorizonMaskService, site_id: str, body: Body
) -> None:
    """Where the terrain horizon at the body's azimuth is ≥ 0°, terrain can only hide more
    of the disk than the flat horizon does. Checked per sample, over one year."""
    mask = _mask_at(masks, *_catalog_point(site_id))
    timeline = _timeline(spice_context, mask, body, _year_ets(spice_context))
    assert timeline.terrain is not None
    terrain_f = timeline.terrain.disk.visible_fraction
    astro_f = timeline.astronomical.disk.visible_fraction
    above = timeline.terrain.disk.horizon_elevation_deg >= 0.0
    # Vacuous where the horizon toward the body is below 0° all year (peaks, see below).
    assert np.all(terrain_f[above] <= astro_f[above] + 1e-12)
    for summary in (timeline.astronomical.summary, timeline.terrain.summary):
        total = sum(w.duration_s for w in summary.visible_windows + summary.hidden_windows)
        assert total == pytest.approx(365 * 86_400.0, abs=1e-3)


@pytest.mark.parametrize("site_id", ["pgda78-site01", "pgda78-site07"])
def test_from_a_peak_the_earth_is_visible_more_often_than_above_zero_degrees(
    spice_context: SpiceContext, masks: HorizonMaskService, site_id: str
) -> None:
    """Site01 (ridge) and Site07 (peak): the horizon toward the Earth dips below 0° all
    year, so terrain Earth visibility exceeds the astronomical value (SCIENCE.md §5.4)."""
    mask = _mask_at(masks, *_catalog_point(site_id))
    earth = _timeline(spice_context, mask, Body.EARTH, _year_ets(spice_context))
    assert earth.terrain is not None
    assert np.all(earth.terrain.disk.horizon_elevation_deg < 0.0)
    terrain = earth.terrain.summary.illuminated_fraction
    assert terrain > earth.astronomical.summary.illuminated_fraction
