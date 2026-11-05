"""Illumination and Earth-visibility timelines for a registered site (C4, T-24).

Geometry, request validation and errors come from the ephemeris service, so both
endpoints share one window cap and one set of error codes. Terrain horizons come from
horizon masks (C1, produced by S-TERRAIN T-15); until a mask service exists, results
report the astronomical horizon only and say so (``terrain_horizon_available: false``).
"""

from __future__ import annotations

import threading
from datetime import datetime, timedelta
from typing import Protocol

from lunaris_api import __version__
from lunaris_api.schemas.ephemeris import MAX_EPHEMERIS_SAMPLES
from lunaris_api.schemas.illumination import (
    IlluminationResult,
    IlluminationSummary,
    SoftwareComponent,
    SoftwareProvenance,
    SolarGeometrySample,
    TimelineAnalysis,
    TimelineRequest,
)
from lunaris_api.schemas.visibility import (
    EarthGeometrySample,
    EarthVisibilityResult,
    EarthVisibilitySummary,
    VisibilityWindow,
)
from lunaris_api.services.ephemeris import EphemerisService, evidence_schema, observer_schema
from lunaris_api.services.sites import SiteService
from lunaris_data.readers.ldem import read_ldem_polar
from lunaris_data.registry import DatasetRegistry
from lunaris_data.runtime import data_runtime
from lunaris_data.store import DataLayout, utc_now
from lunaris_data.validation.integrity import verify_dataset
from lunaris_science.geometry import Body
from lunaris_science.horizon_mask import HorizonMask
from lunaris_science.illumination.analysis import BodyTimeline, HorizonTimeline, body_timeline
from lunaris_science.illumination.timeline import Window
from lunaris_science.provenance import SourceReference
from lunaris_science.runtime import scientific_runtime
from lunaris_science.terrain.dem import PolarDem
from lunaris_science.terrain.horizon import HorizonError, compute_horizon_mask
from lunaris_science.visibility import classify_line_of_sight


def _windows(
    windows: tuple[Window, ...], epochs: tuple[datetime, ...], step_s: float, end: datetime
) -> list[VisibilityWindow]:
    """UTC windows; each sample's interval is clipped to the requested window end."""
    step = timedelta(seconds=step_s)
    return [
        VisibilityWindow(
            start_utc=epochs[w.start_index],
            end_utc=min(epochs[w.end_index] + step, end),
            duration_s=w.duration_s,
            censored_start=w.censored_start,
            censored_end=w.censored_end,
        )
        for w in windows
    ]


def _illumination_summary(
    timeline: HorizonTimeline, epochs: tuple[datetime, ...], step_s: float, end: datetime
) -> IlluminationSummary:
    s = timeline.summary
    return IlluminationSummary(
        horizon=timeline.horizon.value,
        mean_visible_disk_fraction=s.mean_visible_disk_fraction,
        illuminated_fraction=s.illuminated_fraction,
        fully_lit_fraction=s.fully_visible_fraction,
        longest_illumination_s=s.longest_visible.duration_s,
        longest_illumination_censored=s.longest_visible.censored,
        longest_darkness_s=s.longest_hidden.duration_s,
        longest_darkness_censored=s.longest_hidden.censored,
        resolution_s=step_s,
        any_truncated=s.any_truncated,
        sunlit_windows=_windows(s.visible_windows, epochs, step_s, end),
    )


def _earth_summary(
    timeline: HorizonTimeline, epochs: tuple[datetime, ...], step_s: float, end: datetime
) -> EarthVisibilitySummary:
    s = timeline.summary
    return EarthVisibilitySummary(
        horizon=timeline.horizon.value,
        visible_fraction=s.illuminated_fraction,
        mean_visible_disk_fraction=s.mean_visible_disk_fraction,
        fully_visible_fraction=s.fully_visible_fraction,
        longest_visibility_s=s.longest_visible.duration_s,
        longest_visibility_censored=s.longest_visible.censored,
        longest_outage_s=s.longest_hidden.duration_s,
        longest_outage_censored=s.longest_hidden.censored,
        resolution_s=step_s,
        any_truncated=s.any_truncated,
        windows=_windows(s.visible_windows, epochs, step_s, end),
    )


def _terrain_columns(
    timeline: BodyTimeline, n: int
) -> tuple[list[float | None], list[float | None], list[bool | None]]:
    if timeline.terrain is None:
        return [None] * n, [None] * n, [None] * n
    disk = timeline.terrain.disk
    return (
        list(disk.horizon_elevation_deg.tolist()),
        list(disk.visible_fraction.tolist()),
        list(disk.truncated.tolist()),
    )


def _illumination(
    timeline: BodyTimeline, epochs: tuple[datetime, ...], step_s: float, end: datetime
) -> IlluminationResult:
    g = timeline.geometry
    horizon_el, terrain_f, truncated = _terrain_columns(timeline, len(epochs))
    samples = [
        SolarGeometrySample(
            epoch_utc=epoch,
            azimuth_deg=az,
            elevation_deg=el,
            solar_radius_deg=radius,
            astronomical_visible_fraction=astro,
            terrain_horizon_elevation_deg=h,
            terrain_visible_fraction=f,
            terrain_truncated=t,
        )
        for epoch, az, el, radius, astro, h, f, t in zip(
            epochs,
            g.azimuth_deg.tolist(),
            g.elevation_deg.tolist(),
            g.angular_radius_deg.tolist(),
            timeline.astronomical.disk.visible_fraction.tolist(),
            horizon_el,
            terrain_f,
            truncated,
            strict=True,
        )
    ]
    return IlluminationResult(
        body="sun",
        samples=samples,
        astronomical=_illumination_summary(timeline.astronomical, epochs, step_s, end),
        terrain=(
            _illumination_summary(timeline.terrain, epochs, step_s, end)
            if timeline.terrain
            else None
        ),
        evidence=evidence_schema(timeline.evidence),
        limitations=list(timeline.limitations),
    )


def _earth(
    timeline: BodyTimeline, epochs: tuple[datetime, ...], step_s: float, end: datetime
) -> EarthVisibilityResult:
    g = timeline.geometry
    horizon_el, terrain_f, truncated = _terrain_columns(timeline, len(epochs))
    states = classify_line_of_sight(
        timeline.astronomical.disk.visible_fraction,
        timeline.terrain.disk.visible_fraction if timeline.terrain else None,
    ).tolist()
    samples = [
        EarthGeometrySample(
            epoch_utc=epoch,
            azimuth_deg=az,
            elevation_deg=el,
            earth_radius_deg=radius,
            astronomical_visible_fraction=astro,
            terrain_horizon_elevation_deg=h,
            terrain_visible_fraction=f,
            terrain_truncated=t,
            line_of_sight=state,
        )
        for epoch, az, el, radius, astro, h, f, t, state in zip(
            epochs,
            g.azimuth_deg.tolist(),
            g.elevation_deg.tolist(),
            g.angular_radius_deg.tolist(),
            timeline.astronomical.disk.visible_fraction.tolist(),
            horizon_el,
            terrain_f,
            truncated,
            states,
            strict=True,
        )
    ]
    return EarthVisibilityResult(
        body="earth",
        samples=samples,
        astronomical=_earth_summary(timeline.astronomical, epochs, step_s, end),
        terrain=(
            _earth_summary(timeline.terrain, epochs, step_s, end) if timeline.terrain else None
        ),
        evidence=evidence_schema(timeline.evidence),
        limitations=list(timeline.limitations),
    )


def dem_source(mask: HorizonMask, registry: DatasetRegistry) -> SourceReference:
    """Provenance of the DEM file a mask came from: manifest dataset id, file URL and the
    SHA-256 the mask records, matched against the manifest's pinned checksum."""
    manifest = registry.get(mask.dem_source_id)
    spec = next((f for f in manifest.files if f.sha256 == mask.dem_sha256), None)
    if spec is None:
        raise ValueError(
            f"horizon mask DEM checksum {mask.dem_sha256} matches no file pinned in the "
            f"{manifest.id} manifest"
        )
    return SourceReference(
        source_id=f"{manifest.id}/{spec.name}",
        title=spec.description or spec.name,
        url=str(spec.url),
        sha256=mask.dem_sha256,
        citation=manifest.citation,
    )


def _software() -> SoftwareProvenance:
    return SoftwareProvenance(
        service_version=__version__,
        components=[
            SoftwareComponent(name=c.name, version=c.version)
            for c in (*scientific_runtime(), *data_runtime())
        ],
    )


DEFAULT_OBSERVER_HEIGHT_M = 2.0
"""Eye height above the DEM surface for terrain horizons (S-TERRAIN's service default)."""


class TerrainUnavailableError(Exception):
    """No terrain horizon can be produced for the site; the reason is user-facing."""


class HorizonMaskProvider(Protocol):
    """Source of C1 horizon masks. S-TERRAIN's ``HorizonMaskService`` (T-16) satisfies it."""

    def get_site_mask(
        self, site_id: str, *, observer_height_m: float = DEFAULT_OBSERVER_HEIGHT_M
    ) -> HorizonMask: ...


_dem_lock = threading.Lock()
_dem_cache: dict[tuple[str, str], PolarDem] = {}
_mask_cache: dict[tuple[str, float, float, float], HorizonMask] = {}
_MASK_CACHE_LIMIT = 256


class LocalHorizonMaskProvider:
    """Interim provider: T-15's ``compute_horizon_mask`` on the checksum-verified
    LDEM_75S_240M, cached in memory per process. Replaced by S-TERRAIN's file-cached
    ``HorizonMaskService`` when it lands (same interface)."""

    def __init__(self, registry: DatasetRegistry, layout: DataLayout, sites: SiteService) -> None:
        self._registry = registry
        self._layout = layout
        self._sites = sites

    def _dem(self) -> PolarDem:
        manifest = self._registry.get(LDEM_DATASET_ID)
        key = (str(self._layout.root), manifest.fingerprint())
        with _dem_lock:
            dem = _dem_cache.get(key)
            if dem is None:
                if not verify_dataset(manifest, self._layout).ok:
                    raise TerrainUnavailableError(
                        f"the {LDEM_DATASET_ID} DEM is not acquired or fails checksum "
                        "verification on this server"
                    )
                label = self._layout.dataset_dir(manifest) / "LDEM_75S_240M.LBL"
                dem = read_ldem_polar(label, LDEM_DATASET_ID)
                _dem_cache.clear()
                _dem_cache[key] = dem
            return dem

    def get_site_mask(
        self, site_id: str, *, observer_height_m: float = DEFAULT_OBSERVER_HEIGHT_M
    ) -> HorizonMask:
        site = self._sites.get_site(site_id)
        lat, lon = site.coordinate.latitude_deg, site.coordinate.longitude_deg
        dem = self._dem()
        key = (LDEM_DATASET_ID, lat, lon, observer_height_m)
        with _dem_lock:
            cached = _mask_cache.get(key)
        if cached is not None:
            return cached
        try:
            mask = compute_horizon_mask(dem, lat, lon, observer_height_m=observer_height_m)
        except HorizonError as exc:
            raise TerrainUnavailableError(
                f"no terrain horizon for this site: {exc} (LDEM_75S_240M covers 75°–90° S)"
            ) from exc
        with _dem_lock:
            if len(_mask_cache) >= _MASK_CACHE_LIMIT:
                _mask_cache.clear()
            _mask_cache[key] = mask
        return mask


class TimelineService:
    """Illumination and Earth-visibility timelines (contract C4)."""

    def __init__(
        self, ephemeris: EphemerisService, masks: HorizonMaskProvider | None = None
    ) -> None:
        self._ephemeris = ephemeris
        self._masks = masks

    def _terrain_mask(self, site_id: str) -> tuple[HorizonMask | None, str | None]:
        """The site's horizon mask, or None and the reason none is available."""
        if self._masks is None:
            return None, "no horizon mask provider is configured"
        try:
            return self._masks.get_site_mask(site_id), None
        except TerrainUnavailableError as exc:
            return None, str(exc)

    def timeline(self, request: TimelineRequest) -> TimelineAnalysis:
        self._ephemeris.site(request.site_id)  # 404 before any terrain work
        mask, unavailable_reason = self._terrain_mask(request.site_id)
        geometry = self._ephemeris.compute_geometry(
            request.site_id,
            request.start_utc,
            request.end_utc,
            request.step_s,
            location="body",
            surface_height_m=mask.surface_height_m if mask is not None else None,
            observer_height_m=mask.observer_height_m if mask is not None else 0.0,
        )
        source = dem_source(mask, self._ephemeris.registry) if mask is not None else None
        sun = body_timeline(
            geometry.series[Body.SUN],
            mask,
            dem_source=source,
            window_end_et_s=geometry.window_end_et_s,
            terrain_unavailable_reason=unavailable_reason,
        )
        earth = body_timeline(
            geometry.series[Body.EARTH],
            mask,
            dem_source=source,
            window_end_et_s=geometry.window_end_et_s,
            terrain_unavailable_reason=unavailable_reason,
        )
        return TimelineAnalysis(
            site_id=geometry.site_id,
            site_name=geometry.site_name,
            observer=observer_schema(geometry.observer),
            start_utc=request.start_utc,
            end_utc=request.end_utc,
            step_s=request.step_s,
            sample_count=len(geometry.epochs),
            max_samples=MAX_EPHEMERIS_SAMPLES,
            terrain_horizon_available=mask is not None,
            illumination=_illumination(sun, geometry.epochs, request.step_s, request.end_utc),
            earth_visibility=_earth(earth, geometry.epochs, request.step_s, request.end_utc),
            computed_at_utc=utc_now(),
            software=_software(),
        )


LDEM_DATASET_ID = "lola-ldem-75s-240m"

__all__ = [
    "HorizonMaskProvider",
    "LocalHorizonMaskProvider",
    "TerrainUnavailableError",
    "TimelineService",
    "dem_source",
]
