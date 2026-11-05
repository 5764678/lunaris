"""T-25: published reference values and the comparison harness.

The fixture holds values read from the published LOLA average-visibility maps
(Mazarico et al. 2011) by data/fixtures/validation/build_published_illumination.py. The
harness is exercised here against synthetic geometry and a synthetic horizon mask (not
lunar data); the real-mask comparison follows S-TERRAIN T-15.
"""

from __future__ import annotations

import json
from datetime import date
from importlib import resources
from pathlib import Path

import numpy as np
import pytest

from lunaris_science.geometry import Body
from lunaris_science.illumination.analysis import body_timeline
from lunaris_science.illumination.timeline import sample_weights
from lunaris_science.illumination.validation import (
    PublishedReference,
    ValidationError,
    compare,
)
from tests.science.illumination.test_analysis import _geometry, _mask

FIXTURE = (
    Path(__file__).resolve().parents[3]
    / "data"
    / "fixtures"
    / "validation"
    / "published-illumination.json"
)
DEMO_TRIO = ("pgda78-site01", "pgda78-site23", "pgda78-site07")


@pytest.fixture(scope="module")
def fixture() -> dict[str, object]:
    payload: dict[str, object] = json.loads(FIXTURE.read_text(encoding="utf-8"))
    return payload


def _source(fixture: dict[str, object]) -> dict[str, object]:
    sources = fixture["sources"]
    assert isinstance(sources, dict)
    block: dict[str, object] = sources["mazarico2011_maps"]
    return block


def test_fixture_covers_every_catalogue_site_for_sun_and_earth(fixture: dict[str, object]) -> None:
    catalog = resources.files("lunaris_data.catalogs") / "south-pole-candidate-sites.json"
    site_ids = {s["id"] for s in json.loads(catalog.read_text(encoding="utf-8"))["sites"]}
    entries = fixture["entries"]
    assert isinstance(entries, list)
    assert {(e["site_id"], e["body"]) for e in entries} == {
        (s, b) for s in site_ids for b in ("sun", "earth")
    }
    assert set(DEMO_TRIO) <= site_ids


def test_every_entry_is_traceable_to_its_product(fixture: dict[str, object]) -> None:
    source = _source(fixture)
    products = source["products"]
    assert isinstance(products, dict)
    assert "doi:10.1016/j.icarus.2010.10.030" in str(source["citation"])
    for entry in fixture["entries"]:  # type: ignore[attr-defined]
        reference = PublishedReference.from_fixture(entry, source)
        assert reference.product_url.startswith("https://pds-geosciences.wustl.edu/")
        assert len(reference.product_sha256) == 64
        assert entry["product_id"] == products[entry["body"]]["product_id"]
    sha = {e["body"]: e["product_sha256"] for e in fixture["entries"]}  # type: ignore[attr-defined]
    assert sha == {
        "sun": "103d71ccf377fc5444b3f52c35a89069d008d1ac9b763408ca853378fa440fa5",
        "earth": "7563b4cd4f9371452930f0fee80ba1b9a20a6a8e25ad75b1e10d37b56c9aad85",
    }


def test_unavailable_sources_are_recorded_as_such_not_filled_in(fixture: dict[str, object]) -> None:
    sources = fixture["sources"]
    assert isinstance(sources, dict)
    assert sources["paper_tables"]["status"] == "unavailable"
    assert "not reachable" in sources["paper_tables"]["reason"]
    barker = sources["barker2021_site_statement"]
    assert barker["status"] == "qualitative"
    assert barker["read_from"] == "https://pgda.gsfc.nasa.gov/products/78"


def test_published_site01_value_is_consistent_with_barker_2021(fixture: dict[str, object]) -> None:
    """Two published sources, not LUNARIS: the Mazarico map at Site01 (>70%) agrees with
    Barker et al.'s statement that Site 1 has area with average illumination > 70%."""
    site01 = next(
        e
        for e in fixture["entries"]  # type: ignore[attr-defined]
        if e["site_id"] == "pgda78-site01" and e["body"] == "sun"
    )
    assert site01["local_3x3"]["max"] > 0.70


def test_comparison_states_differences_and_judges_against_the_local_spread() -> None:
    reference = PublishedReference(
        entry_id="synthetic",
        site_id="synthetic-site",
        body="sun",
        quantity="illuminated_fraction",
        value=0.5,
        local_min=0.4,
        local_max=0.6,
        period_start=date(2001, 1, 1),
        period_end=date(2018, 8, 8),
        resolution_m=240.0,
        citation="synthetic reference (test only)",
        product_url="https://example.invalid/product",
        product_sha256="3" * 64,
    )
    # Synthetic Sun crossing a 0.5° terrain horizon.
    elevation = np.linspace(-1.0, 1.5, 51)
    timeline = body_timeline(_geometry(Body.SUN, elevation, 0.27), _mask(0.5))
    assert timeline.terrain is not None
    result = compare(
        reference,
        timeline.terrain.summary,
        period_start=date(2026, 1, 1),
        period_end=date(2026, 12, 31),
        dem_resolution_m=240.0,
        observer_height_m=2.0,
    )
    # Interval-weighted share of the window (the last sample of an end-inclusive grid
    # weighs 0; docs/SCIENCE.md §5.3).
    weights = sample_weights(timeline.geometry.epochs_et_s)
    visible = timeline.terrain.disk.visible_fraction > 0.0
    expected = float(np.sum(weights * visible) / np.sum(weights))
    assert result.computed_value == expected
    assert result.difference == pytest.approx(expected - 0.5)
    assert result.within_local_spread is (0.4 <= expected <= 0.6)
    text = " ".join(result.stated_differences)
    assert "Period" in text
    assert "18.6-year" in text
    assert "Observer height: computed 2 m" in text
    assert "DEM resolution" not in text  # same resolution: no spurious difference
    assert not result.computed_is_upper_bound


def test_truncated_horizons_make_the_computed_value_an_upper_bound() -> None:
    reference = PublishedReference(
        "synthetic",
        "s",
        "sun",
        "illuminated_fraction",
        0.5,
        0.4,
        0.6,
        date(2001, 1, 1),
        date(2018, 8, 8),
        240.0,
        "synthetic",
        "https://example.invalid",
        "3" * 64,
    )
    truncated = np.zeros(1440, dtype=bool)
    truncated[480] = True
    timeline = body_timeline(_geometry(Body.SUN, np.zeros(6), 0.27), _mask(0.0, truncated))
    assert timeline.terrain is not None
    result = compare(
        reference,
        timeline.terrain.summary,
        period_start=date(2001, 1, 1),
        period_end=date(2018, 8, 8),
        dem_resolution_m=20.0,
        observer_height_m=0.0,
    )
    assert result.computed_is_upper_bound
    assert any("upper bound" in d for d in result.stated_differences)
    assert any("DEM resolution: computed 20 m" in d for d in result.stated_differences)


def test_malformed_references_are_rejected() -> None:
    args = ("x", "s", "sun", "illuminated_fraction")
    tail = (date(2001, 1, 1), date(2018, 8, 8), 240.0, "c", "u", "3" * 64)
    with pytest.raises(ValidationError, match="local spread"):
        PublishedReference(*args, 0.7, 0.4, 0.6, *tail)
    with pytest.raises(ValidationError, match="quantity"):
        PublishedReference("x", "s", "sun", "mean_lux", 0.5, 0.4, 0.6, *tail)
