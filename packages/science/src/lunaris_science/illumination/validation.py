"""Comparison of computed illumination against published values (T-25, D4).

A published value is only comparable with stated differences: the period it averages
over, the DEM and its resolution, the observer height, the horizon range, and how the
site point was chosen. :func:`compare` returns the numeric difference together with
every such difference, so a reader never sees agreement (or disagreement) without its
causes.

Agreement is judged against the published map's local spread (the 3 × 3 neighbourhood
of the reference pixel, 720 m on a 240 m grid), not against a single pixel: near polar
ridges illumination changes by tens of percent over a few hundred metres, so a point
that falls between pixels cannot be expected to match one pixel exactly.

Pure computation; reading the reference fixture is the caller's job.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date
from typing import Any

from lunaris_science.illumination.timeline import FractionSummary

QUANTITIES = frozenset({"illuminated_fraction", "earth_visible_fraction"})
"""Both mean "share of time with any part of the disk visible" (f > 0)."""

PUBLISHED_STEP_S = 3600.0
"""The published maps model every hour."""


class ValidationError(ValueError):
    """Raised for malformed reference entries or incompatible comparisons."""


@dataclass(frozen=True, slots=True)
class PublishedReference:
    entry_id: str
    site_id: str
    body: str
    quantity: str
    value: float
    local_min: float
    local_max: float
    period_start: date
    period_end: date
    resolution_m: float
    citation: str
    product_url: str
    product_sha256: str

    def __post_init__(self) -> None:
        if self.quantity not in QUANTITIES:
            raise ValidationError(f"unsupported quantity {self.quantity!r}")
        for name in ("value", "local_min", "local_max"):
            value = getattr(self, name)
            if not 0.0 <= value <= 1.0:
                raise ValidationError(f"{name} must lie in [0, 1], got {value}")
        if not self.local_min <= self.value <= self.local_max:
            raise ValidationError("value must lie within its local spread")

    @classmethod
    def from_fixture(
        cls, entry: Mapping[str, Any], source: Mapping[str, Any]
    ) -> PublishedReference:
        """Build from one ``entries`` item and the ``mazarico2011_maps`` source block of
        ``data/fixtures/validation/published-illumination.json``."""
        period = source["period"]
        return cls(
            entry_id=str(entry["id"]),
            site_id=str(entry["site_id"]),
            body=str(entry["body"]),
            quantity=str(entry["quantity"]),
            value=float(entry["value"]),
            local_min=float(entry["local_3x3"]["min"]),
            local_max=float(entry["local_3x3"]["max"]),
            period_start=date.fromisoformat(period["start_utc"]),
            period_end=date.fromisoformat(period["end_utc"]),
            resolution_m=float(source["resolution_m"]),
            citation=str(source["citation"]),
            product_url=str(entry["product_url"]),
            product_sha256=str(entry["product_sha256"]),
        )


@dataclass(frozen=True, slots=True)
class ValidationComparison:
    reference: PublishedReference
    computed_value: float
    difference: float
    """computed − published."""
    within_local_spread: bool
    """True when the computed value lies within the published 3 × 3 range."""
    computed_is_upper_bound: bool
    """True when the computed value used truncated horizon samples (an upper bound)."""
    stated_differences: tuple[str, ...]


def compare(
    reference: PublishedReference,
    summary: FractionSummary,
    *,
    period_start: date,
    period_end: date,
    dem_resolution_m: float,
    observer_height_m: float,
    point_note: str = (
        "LUNARIS evaluates the catalogue reference point exactly; the published value is "
        "the 240 m pixel containing it."
    ),
) -> ValidationComparison:
    """Compare a computed summary with one published reference, stating every difference."""
    computed = summary.illuminated_fraction  # share of samples with f > 0, both quantities
    differences = [point_note]
    if (period_start, period_end) != (reference.period_start, reference.period_end):
        differences.append(
            f"Period: computed {period_start} → {period_end}, published "
            f"{reference.period_start} → {reference.period_end}. Polar illumination varies "
            "with the 18.6-year lunar precession cycle, so shorter periods need not agree."
        )
    if dem_resolution_m != reference.resolution_m:
        differences.append(
            f"DEM resolution: computed {dem_resolution_m:g} m, published "
            f"{reference.resolution_m:g} m."
        )
    differences.append(
        f"Observer height: computed {observer_height_m:g} m above the DEM surface; the "
        "published labels do not state one."
    )
    differences.append(
        f"Sampling: computed every {summary.step_s:g} s; published hourly."
        if summary.step_s != PUBLISHED_STEP_S
        else "Sampling: hourly in both."
    )
    if summary.any_truncated:
        differences.append(
            "Some computed samples used horizon azimuths where the ray left DEM coverage: "
            "the computed value is an upper bound."
        )
    return ValidationComparison(
        reference=reference,
        computed_value=computed,
        difference=computed - reference.value,
        within_local_spread=reference.local_min <= computed <= reference.local_max,
        computed_is_upper_bound=summary.any_truncated,
        stated_differences=tuple(differences),
    )


__all__ = [
    "QUANTITIES",
    "PublishedReference",
    "ValidationComparison",
    "ValidationError",
    "compare",
]
