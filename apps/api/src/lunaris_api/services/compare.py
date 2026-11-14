"""Site comparison table (T-17): one row per site, one evidence record per cell.

Sources per column:
* surface height and horizon summary: the T-16 horizon mask from LDEM_75S_240M;
* slope at site, p95 slope, roughness: T-14 analysis of a PGDA 20 m window;
* Sun and Earth summaries: S-GEOMETRY's terrain-horizon timeline (T-24). Until that
  service is available, those cells are null with the reason
  ``terrain illumination not available``.

A cell that cannot be computed is ``null`` with a reason, never 0.

Row cache: the cells of a row depend only on the site's id and coordinates and on
(start, end, step_s, observer_height_m, footprint_radius_m), so they are memoized in a
bounded, thread-safe LRU shared by every request of an app (:func:`row_cache_for`).
``summary`` and the mission recommendation are recomputed from the rows on every request, and
the mission answers are never part of the key. A row is not cached when any of its cells came from a
server-side failure (status >= 500, e.g. PGDA unreachable or a dataset not acquired):
those can recover, and caching them would freeze an outage. Deterministic nulls
(outside coverage, no terrain horizon in the timeline) are cached.
"""

from __future__ import annotations

import math
import threading
from collections import OrderedDict
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Any

import numpy as np

from lunaris_api.errors import ApiError
from lunaris_api.schemas.common import ErrorDetail, EvidenceSchema, SourceReferenceSchema
from lunaris_api.schemas.compare import (
    CompareCell,
    CompareColumn,
    CompareRow,
    Mission,
    SiteComparison,
)
from lunaris_api.schemas.ephemeris import MAX_EPHEMERIS_SAMPLES
from lunaris_api.schemas.illumination import TimelineRequest
from lunaris_api.schemas.sites import CandidateSite
from lunaris_api.schemas.terrain import SiteTerrainResponse
from lunaris_api.services.compare_recommend import CENSORED_NOTE
from lunaris_api.services.compare_summary import summarize, with_directions
from lunaris_api.services.horizon import HorizonMaskService
from lunaris_api.services.illumination import TimelineService
from lunaris_api.services.sites import SiteService
from lunaris_api.services.terrain import SiteTerrainService
from lunaris_science.geometry import sample_count
from lunaris_science.horizon_mask import HorizonMask

MAX_COMPARE_SITES = 10
DEFAULT_FOOTPRINT_RADIUS_M = 50.0
ILLUMINATION_UNAVAILABLE = "terrain illumination not available"

COLUMNS = [
    CompareColumn(
        key="surface_height_m",
        label="Height",
        unit="m",
        description="LDEM_75S_240M height at the site above the 1 737 400 m sphere.",
    ),
    CompareColumn(
        key="slope_at_site_deg",
        label="Slope at site",
        unit="deg",
        description="Horn slope on PGDA 20 m, with its baseline.",
    ),
    CompareColumn(
        key="slope_p95_deg",
        label="Slope p95 (footprint)",
        unit="deg",
        description="95th-percentile Horn slope over the footprint.",
    ),
    CompareColumn(
        key="roughness_rms_m",
        label="Roughness",
        unit="m",
        description="Plane-fit RMS over the footprint diameter (baseline).",
    ),
    CompareColumn(
        key="horizon_min_deg",
        label="Horizon min",
        unit="deg",
        description="Lowest terrain-horizon elevation over 360° of azimuth.",
    ),
    CompareColumn(
        key="horizon_max_deg",
        label="Horizon max",
        unit="deg",
        description="Highest terrain-horizon elevation over 360° of azimuth.",
    ),
    CompareColumn(
        key="horizon_truncated_azimuths",
        label="Truncated azimuths",
        unit="count",
        description="Azimuths whose 200 km ray left LDEM coverage (lower bounds).",
    ),
    CompareColumn(
        key="sun_mean_visible_disk_fraction",
        label="Sun: mean visible disk",
        unit="fraction",
        description="Time-averaged visible solar-disk fraction.",
    ),
    CompareColumn(
        key="sun_illuminated_fraction",
        label="Sun: illuminated",
        unit="fraction",
        description="Share of samples with any part of the solar disk visible.",
    ),
    CompareColumn(
        key="sun_longest_hidden_s",
        label="Sun: longest darkness",
        unit="s",
        description="Longest continuous period with the solar disk hidden.",
    ),
    CompareColumn(
        key="sun_longest_visible_s",
        label="Sun: longest sunlit period",
        unit="s",
        description="Longest continuous period with any part of the solar disk visible.",
    ),
    CompareColumn(
        key="earth_visible_fraction",
        label="Earth: visible",
        unit="fraction",
        description="Share of samples with Earth's centre in geometric view.",
    ),
    CompareColumn(
        key="earth_longest_outage_s",
        label="Earth: longest outage",
        unit="s",
        description="Longest continuous period without Earth in view.",
    ),
]
DIRECTED_COLUMNS = with_directions(COLUMNS)
"""COLUMNS with their declared `better` direction and rationale (T-18, D9)."""

ILLUMINATION_KEYS = (
    "sun_mean_visible_disk_fraction",
    "sun_illuminated_fraction",
    "sun_longest_hidden_s",
    "sun_longest_visible_s",
    "earth_visible_fraction",
    "earth_longest_outage_s",
)

IlluminationProvider = Callable[[str, datetime, datetime, float, float], dict[str, CompareCell]]
"""(site_id, start, end, step_s, observer_height_m) -> cells for ILLUMINATION_KEYS."""


class CompareRequestError(ApiError):
    status_code = 422
    code = "validation_error"

    def __init__(self, message: str, location: list[str | int], kind: str) -> None:
        super().__init__(
            message, details=[ErrorDetail(location=location, message=message, type=kind)]
        )


DEFAULT_ROW_CACHE_SIZE = 64

RowKey = tuple[str, float, float, datetime, datetime, float, float, float]
"""(site id, latitude, longitude, start, end, step_s, observer_height_m, footprint_radius_m)."""

Cells = dict[str, CompareCell]


class RowCache:
    """Bounded, thread-safe LRU of row cells (schemas are frozen, so sharing is safe)."""

    def __init__(self, max_rows: int = DEFAULT_ROW_CACHE_SIZE) -> None:
        if max_rows < 1:
            raise ValueError("max_rows must be at least 1")
        self._max_rows = max_rows
        self._rows: OrderedDict[RowKey, Cells] = OrderedDict()
        self._lock = threading.Lock()
        self.hits = 0
        self.misses = 0

    def get(self, key: RowKey) -> Cells | None:
        with self._lock:
            cells = self._rows.get(key)
            if cells is None:
                self.misses += 1
                return None
            self._rows.move_to_end(key)
            self.hits += 1
            return cells

    def put(self, key: RowKey, cells: Cells) -> None:
        with self._lock:
            self._rows[key] = cells
            self._rows.move_to_end(key)
            while len(self._rows) > self._max_rows:
                self._rows.popitem(last=False)

    def __len__(self) -> int:
        with self._lock:
            return len(self._rows)

    def clear(self) -> None:
        with self._lock:
            self._rows.clear()


_STATE_LOCK = threading.Lock()


def row_cache_for(state: Any) -> RowCache:
    """The app-wide row cache, created on first use and kept on ``app.state``."""
    with _STATE_LOCK:
        cache = getattr(state, "compare_row_cache", None)
        if cache is None:
            cache = RowCache()
            state.compare_row_cache = cache
        return cache


def _transient(exc: ApiError) -> bool:
    """Server-side failures (>= 500) may recover; client-side ones (422) are deterministic."""
    return exc.status_code >= 500  # noqa: PLR2004


def _null(unit: str, reason: str) -> CompareCell:
    return CompareCell(value=None, unit=unit, reason=reason)


def _finite(value: float | None) -> float | None:
    return value if value is not None and math.isfinite(value) else None


class CompareService:
    def __init__(
        self,
        sites: SiteService,
        horizon: HorizonMaskService,
        terrain: SiteTerrainService,
        illumination: IlluminationProvider | None = None,
        row_cache: RowCache | None = None,
    ) -> None:
        self._sites = sites
        self._horizon = horizon
        self._terrain = terrain
        self._illumination = illumination
        self._row_cache = row_cache

    def compare(
        self,
        site_ids: list[str],
        start_utc: datetime,
        end_utc: datetime,
        step_s: float,
        *,
        observer_height_m: float,
        footprint_radius_m: float = DEFAULT_FOOTPRINT_RADIUS_M,
        mission: Mission | None = None,
    ) -> SiteComparison:
        ids = list(dict.fromkeys(i.strip() for i in site_ids if i.strip()))
        if not 1 <= len(ids) <= MAX_COMPARE_SITES:
            raise CompareRequestError(
                f"give 1 to {MAX_COMPARE_SITES} distinct site ids",
                ["query", "site_ids"],
                "site_count",
            )
        for name, value in (("start_utc", start_utc), ("end_utc", end_utc)):
            if value.utcoffset() != timedelta(0):
                raise CompareRequestError(f"{name} must be UTC", ["query", name], "utc_required")
        if end_utc <= start_utc:
            raise CompareRequestError(
                "end_utc must be after start_utc", ["query", "end_utc"], "window_order"
            )
        count = sample_count(start_utc, end_utc, step_s)
        if count > MAX_EPHEMERIS_SAMPLES:
            raise CompareRequestError(
                f"the window and step give {count} samples; at most {MAX_EPHEMERIS_SAMPLES} are "
                "allowed. Increase step_s or shorten the window.",
                ["query", "step_s"],
                "sample_cap_exceeded",
            )
        sites = [self._sites.get_site(i) for i in ids]  # 404 for unknown ids
        rows = [
            self._row(
                s,
                start=start_utc,
                end=end_utc,
                step_s=step_s,
                observer_height_m=observer_height_m,
                footprint_radius_m=footprint_radius_m,
            )
            for s in sites
        ]
        return SiteComparison(
            start_utc=start_utc,
            end_utc=end_utc,
            step_s=step_s,
            sample_count=count,
            observer_height_m=observer_height_m,
            footprint_radius_m=footprint_radius_m,
            columns=DIRECTED_COLUMNS,
            rows=rows,
            assumptions=[
                f"Observer eye {observer_height_m:g} m above the surface (horizon and timelines).",
                f"Footprint radius {footprint_radius_m:g} m for slope p95 and roughness.",
            ],
            summary=summarize(rows, DIRECTED_COLUMNS, mission=mission),
        )

    # ── cells ────────────────────────────────────────────────────────────────

    def _row(
        self,
        site: CandidateSite,
        *,
        start: datetime,
        end: datetime,
        step_s: float,
        observer_height_m: float,
        footprint_radius_m: float,
    ) -> CompareRow:
        key: RowKey = (
            site.id,
            float(site.coordinate.latitude_deg),
            float(site.coordinate.longitude_deg),
            start,
            end,
            float(step_s),
            float(observer_height_m),
            float(footprint_radius_m),
        )
        cells = self._row_cache.get(key) if self._row_cache is not None else None
        if cells is None:
            horizon, h_ok = self._horizon_cells(site, observer_height_m)
            terrain, t_ok = self._terrain_cells(site, footprint_radius_m)
            light, i_ok = self._illumination_cells(site, start, end, step_s, observer_height_m)
            cells = {**horizon, **terrain, **light}
            if self._row_cache is not None and h_ok and t_ok and i_ok:
                self._row_cache.put(key, cells)
        # Identity fields come from the current site, never from the cache.
        return CompareRow(
            site_id=site.id,
            name=site.name,
            origin=site.origin,
            latitude_deg=site.coordinate.latitude_deg,
            longitude_deg=site.coordinate.longitude_deg,
            **cells,
        )

    def _horizon_cells(self, site: CandidateSite, observer_height_m: float) -> tuple[Cells, bool]:
        """Cells, and whether they may be cached (no transient failure)."""
        keys = {
            "surface_height_m": "m",
            "horizon_min_deg": "deg",
            "horizon_max_deg": "deg",
            "horizon_truncated_azimuths": "count",
        }
        try:
            mask = self._horizon.get_site_mask(site.id, observer_height_m=observer_height_m)
        except ApiError as exc:
            return {
                k: _null(u, f"horizon mask not available: {exc.message}") for k, u in keys.items()
            }, not _transient(exc)
        manifest = self._horizon.manifest
        data = next(f for f in manifest.files if f.role.value == "data")
        source = SourceReferenceSchema(
            source_id=manifest.id,
            title=manifest.title,
            url=str(data.url),
            sha256=mask.dem_sha256,
            citation=manifest.citation,
        )
        truncated = int(mask.truncated.sum())
        limitation = (
            [f"{truncated} of {mask.size} azimuths left LDEM coverage before 200 km: lower bounds."]
            if truncated
            else []
        )
        height = CompareCell(
            value=mask.surface_height_m,
            unit="m",
            evidence=EvidenceSchema(
                kind="derived_product",
                statement=(
                    "LDEM_75S_240M height at the site (bilinear), above the 1 737 400 m sphere."
                ),
                sources=[source],
                method="Bilinear interpolation of the LOLA GDR grid at the site.",
            ),
        )

        def horizon_cell(value: float, unit: str, what: str) -> CompareCell:
            return CompareCell(
                value=value,
                unit=unit,
                evidence=_mask_evidence(mask, source, what),
                limitations=limitation,
            )

        return {
            "surface_height_m": height,
            "horizon_min_deg": horizon_cell(float(np.min(mask.elevation_deg)), "deg", "minimum"),
            "horizon_max_deg": horizon_cell(float(np.max(mask.elevation_deg)), "deg", "maximum"),
            "horizon_truncated_azimuths": horizon_cell(
                float(truncated), "count", "truncated azimuth count"
            ),
        }, True

    def _terrain_cells(self, site: CandidateSite, footprint_radius_m: float) -> tuple[Cells, bool]:
        keys = {"slope_at_site_deg": "deg", "slope_p95_deg": "deg", "roughness_rms_m": "m"}
        try:
            t = self._terrain.analyze(site, footprint_radius_m=footprint_radius_m, thresholds=None)
        except ApiError as exc:
            return {
                k: _null(u, f"terrain analysis not available: {exc.message}")
                for k, u in keys.items()
            }, not _transient(exc)
        fp = t.footprint
        return {
            "slope_at_site_deg": _terrain_cell(
                t, t.slope_at_site.slope_deg, "deg", t.slope_at_site.baseline_m, "slope at the site"
            ),
            "slope_p95_deg": _terrain_cell(
                t,
                fp.slope_p95_deg,
                "deg",
                fp.slope_baseline_m,
                "95th-percentile slope over the footprint",
            ),
            "roughness_rms_m": _terrain_cell(
                t, fp.roughness_rms_m, "m", fp.roughness_baseline_m, "plane-fit RMS roughness"
            ),
        }, True

    def _illumination_cells(
        self,
        site: CandidateSite,
        start: datetime,
        end: datetime,
        step_s: float,
        observer_height_m: float,
    ) -> tuple[Cells, bool]:
        units = {c.key: c.unit for c in COLUMNS}
        if self._illumination is None:
            return {k: _null(units[k], ILLUMINATION_UNAVAILABLE) for k in ILLUMINATION_KEYS}, True
        try:
            return self._illumination(site.id, start, end, step_s, observer_height_m), True
        except ApiError as exc:
            return {
                k: _null(units[k], f"{ILLUMINATION_UNAVAILABLE}: {exc.message}")
                for k in ILLUMINATION_KEYS
            }, not _transient(exc)


def _mask_evidence(mask: HorizonMask, source: SourceReferenceSchema, what: str) -> EvidenceSchema:
    return EvidenceSchema(
        kind="calculation",
        statement=f"Terrain-horizon {what} over 360° from the site's horizon mask.",
        sources=[source],
        method=mask.method,
        assumptions=[
            f"Observer eye {mask.observer_height_m:g} m above the DEM surface.",
            f"Azimuth step {mask.step_deg:g}°, range {mask.max_range_m / 1000:g} km.",
        ],
    )


def _terrain_cell(
    t: SiteTerrainResponse, value: float | None, unit: str, baseline_m: float, what: str
) -> CompareCell:
    finite = _finite(value)
    return CompareCell(
        value=finite,
        unit=unit,
        baseline_m=baseline_m,
        reason=None if finite is not None else "DEM has no value next to the site",
        evidence=EvidenceSchema(
            kind="calculation",
            statement=f"{what.capitalize()} from a window of {t.dem.title}.",
            sources=t.evidence.sources,
            method=t.evidence.method,
            assumptions=list(t.evidence.assumptions),
        ),
        limitations=list(t.limitations),
    )


def timeline_provider(timelines: TimelineService) -> IlluminationProvider:
    """Illumination/Earth cells from S-GEOMETRY's TimelineService (terrain horizon only).

    While the timeline has no terrain horizon for the site, the cells stay null with
    :data:`ILLUMINATION_UNAVAILABLE`; astronomical-only numbers are not substituted.
    """

    def provide(
        site_id: str, start: datetime, end: datetime, step_s: float, observer_height_m: float
    ) -> dict[str, CompareCell]:
        del observer_height_m  # the timeline places its observer itself (C2)
        analysis = timelines.timeline(
            TimelineRequest(site_id=site_id, start_utc=start, end_utc=end, step_s=step_s)
        )
        sun, earth = analysis.illumination.terrain, analysis.earth_visibility.terrain
        units = {c.key: c.unit for c in COLUMNS}
        if not analysis.terrain_horizon_available or sun is None or earth is None:
            return {k: _null(units[k], ILLUMINATION_UNAVAILABLE) for k in ILLUMINATION_KEYS}
        period = (
            f"Period {start.isoformat()} to {end.isoformat()} at {step_s:g} s steps "
            f"({analysis.sample_count} samples); published values use other periods."
        )
        sun_lim = [period, *analysis.illumination.limitations]
        earth_lim = [period, *analysis.earth_visibility.limitations]

        def cell(
            value: float, key: str, evidence: EvidenceSchema, lim: list[str], censored: bool
        ) -> CompareCell:
            extra = [CENSORED_NOTE] if censored else []
            return CompareCell(
                value=value, unit=units[key], evidence=evidence, limitations=[*lim, *extra]
            )

        return {
            "sun_mean_visible_disk_fraction": cell(
                sun.mean_visible_disk_fraction,
                "sun_mean_visible_disk_fraction",
                analysis.illumination.evidence,
                sun_lim,
                False,
            ),
            "sun_illuminated_fraction": cell(
                sun.illuminated_fraction,
                "sun_illuminated_fraction",
                analysis.illumination.evidence,
                sun_lim,
                False,
            ),
            "sun_longest_hidden_s": cell(
                sun.longest_darkness_s,
                "sun_longest_hidden_s",
                analysis.illumination.evidence,
                sun_lim,
                sun.longest_darkness_censored,
            ),
            "sun_longest_visible_s": cell(
                sun.longest_illumination_s,
                "sun_longest_visible_s",
                analysis.illumination.evidence,
                sun_lim,
                sun.longest_illumination_censored,
            ),
            "earth_visible_fraction": cell(
                earth.visible_fraction,
                "earth_visible_fraction",
                analysis.earth_visibility.evidence,
                earth_lim,
                False,
            ),
            "earth_longest_outage_s": cell(
                earth.longest_outage_s,
                "earth_longest_outage_s",
                analysis.earth_visibility.evidence,
                earth_lim,
                earth.longest_outage_censored,
            ),
        }

    return provide


__all__ = [
    "COLUMNS",
    "DEFAULT_FOOTPRINT_RADIUS_M",
    "ILLUMINATION_UNAVAILABLE",
    "MAX_COMPARE_SITES",
    "CompareService",
    "IlluminationProvider",
    "RowCache",
    "row_cache_for",
    "timeline_provider",
]
