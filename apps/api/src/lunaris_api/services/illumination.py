"""Illumination and Earth-visibility timelines for a registered site (C4, T-24).

Geometry, request validation and errors come from the ephemeris service, so both
endpoints share one window cap and one set of error codes. Terrain horizons come from
horizon masks (C1, produced by S-TERRAIN T-15); until a mask service exists, results
report the astronomical horizon only and say so (``terrain_horizon_available: false``).
"""

from __future__ import annotations

import gzip
import hashlib
import json
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import Protocol

from lunaris_api import __version__
from lunaris_api.logging import get_logger
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
from lunaris_api.services.horizon import DEFAULT_OBSERVER_HEIGHT_M, OutOfCoverageError
from lunaris_api.services.terrain import DatasetUnavailableError
from lunaris_data.registry import DatasetRegistry
from lunaris_data.runtime import data_runtime
from lunaris_data.store import utc_now
from lunaris_science.geometry import Body
from lunaris_science.horizon_mask import HorizonMask
from lunaris_science.illumination.analysis import BodyTimeline, HorizonTimeline, body_timeline
from lunaris_science.illumination.timeline import Window
from lunaris_science.provenance import SourceReference
from lunaris_science.runtime import scientific_runtime
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


class HorizonMaskProvider(Protocol):
    """Source of C1 horizon masks: S-TERRAIN's ``HorizonMaskService`` (file-cached)."""

    def get_site_mask(
        self, site_id: str, *, observer_height_m: float = DEFAULT_OBSERVER_HEIGHT_M
    ) -> HorizonMask: ...


logger = get_logger("timeline")

MAX_CONCURRENT_TIMELINES = 1
"""Computing a full-year hourly timeline peaks at roughly 100 MiB of numpy temporaries, so on a
small host (Render's free plan has 512 MiB) the computations are queued one at a time,
process-wide, instead of running in parallel. Timelines read from disk never wait for it."""
_HEAVY = threading.BoundedSemaphore(MAX_CONCURRENT_TIMELINES)


class TimelineService:
    """Illumination and Earth-visibility timelines (contract C4).

    Timelines computed ahead of time (``apps/api/scripts/prewarm_demo.py`` at image build, with
    ``persist=True``) are served from ``timeline_dir`` instead of being recomputed: on a small
    CPU a cold year-long timeline costs seconds, from disk it costs milliseconds. Requests
    never write there unless ``persist`` is set, so visitors cannot fill the disk with odd
    windows.
    """

    def __init__(
        self,
        ephemeris: EphemerisService,
        masks: HorizonMaskProvider | None = None,
        *,
        timeline_dir: Path | None = None,
        persist: bool = False,
    ) -> None:
        self._ephemeris = ephemeris
        self._masks = masks
        self._timeline_dir = timeline_dir
        self._persist = persist

    # ── timelines baked to disk ──────────────────────────────────────────────

    def _disk_path(
        self, request: TimelineRequest, mask: HorizonMask, lat: float, lon: float
    ) -> Path | None:
        """File for this exact request. The name is a hash of everything the numbers depend
        on (coordinates, window, step, observer height, the DEM checksum the mask was built
        from, and the versions of the service and scientific components), so a code or data
        change never serves a stale file. It does not contain the site id: ids are generated
        per registry, so a file baked at image build serves any registry's copy of the site."""
        if self._timeline_dir is None:
            return None
        identity = json.dumps(
            [
                __version__,
                {c.name: c.version for c in (*scientific_runtime(), *data_runtime())},
                mask.dem_sha256,
                lat,
                lon,
                request.start_utc.isoformat(),
                request.end_utc.isoformat(),
                request.step_s,
                mask.observer_height_m,
            ],
            sort_keys=True,
        )
        return self._timeline_dir / f"{hashlib.sha256(identity.encode()).hexdigest()[:32]}.json.gz"

    @staticmethod
    def _read_baked(path: Path | None) -> TimelineAnalysis | None:
        if path is None or not path.is_file():
            return None
        try:
            return TimelineAnalysis.model_validate_json(gzip.decompress(path.read_bytes()))
        except (OSError, ValueError):
            logger.warning("unreadable baked timeline %s; recomputing", path.name)
            return None

    @staticmethod
    def _write_baked(path: Path | None, analysis: TimelineAnalysis) -> None:
        if path is None:
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_bytes(gzip.compress(analysis.model_dump_json().encode(), compresslevel=6))
        tmp.replace(path)

    def _terrain_mask(self, site_id: str) -> tuple[HorizonMask | None, str | None]:
        """The site's horizon mask, or None and the reason none is available."""
        if self._masks is None:
            return None, "no horizon mask provider is configured"
        try:
            return self._masks.get_site_mask(site_id), None
        except (DatasetUnavailableError, OutOfCoverageError) as exc:
            return None, exc.message

    def timeline(self, request: TimelineRequest) -> TimelineAnalysis:
        site = self._ephemeris.site(request.site_id)  # 404 before any terrain work
        mask, unavailable_reason = self._terrain_mask(request.site_id)
        path = (
            self._disk_path(
                request, mask, site.coordinate.latitude_deg, site.coordinate.longitude_deg
            )
            if mask is not None
            else None
        )
        if (baked := self._read_baked(path)) is not None:
            # The caller's current site record wins over whatever was stored.
            return baked.model_copy(update={"site_id": site.id, "site_name": site.name})
        with _HEAVY:  # bound peak memory; see MAX_CONCURRENT_TIMELINES
            analysis = self._compute(request, mask, unavailable_reason)
        if self._persist:
            self._write_baked(path, analysis)
        return analysis

    def _compute(
        self, request: TimelineRequest, mask: HorizonMask | None, unavailable_reason: str | None
    ) -> TimelineAnalysis:
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


__all__ = ["HorizonMaskProvider", "TimelineService", "dem_source"]
