"""Illumination and Earth-visibility timelines for a registered site (C4, T-24).

Geometry, request validation and errors come from the ephemeris service, so both
endpoints share one window cap and one set of error codes. Terrain horizons come from
horizon masks (C1, produced by S-TERRAIN T-15); until a mask service exists, results
report the astronomical horizon only and say so (``terrain_horizon_available: false``).
"""

from __future__ import annotations

from datetime import datetime, timedelta

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
from lunaris_data.runtime import data_runtime
from lunaris_data.store import utc_now
from lunaris_science.geometry import Body
from lunaris_science.horizon_mask import HorizonMask
from lunaris_science.illumination.analysis import BodyTimeline, HorizonTimeline, body_timeline
from lunaris_science.illumination.timeline import Window
from lunaris_science.runtime import scientific_runtime
from lunaris_science.visibility import classify_line_of_sight


def _windows(
    windows: tuple[Window, ...], epochs: tuple[datetime, ...], step_s: float
) -> list[VisibilityWindow]:
    step = timedelta(seconds=step_s)
    return [
        VisibilityWindow(
            start_utc=epochs[w.start_index],
            end_utc=epochs[w.end_index] + step,
            duration_s=w.duration_s,
            censored_start=w.censored_start,
            censored_end=w.censored_end,
        )
        for w in windows
    ]


def _illumination_summary(
    timeline: HorizonTimeline, epochs: tuple[datetime, ...], step_s: float
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
        sunlit_windows=_windows(s.visible_windows, epochs, step_s),
    )


def _earth_summary(
    timeline: HorizonTimeline, epochs: tuple[datetime, ...], step_s: float
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
        windows=_windows(s.visible_windows, epochs, step_s),
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
    timeline: BodyTimeline, epochs: tuple[datetime, ...], step_s: float
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
        astronomical=_illumination_summary(timeline.astronomical, epochs, step_s),
        terrain=(
            _illumination_summary(timeline.terrain, epochs, step_s) if timeline.terrain else None
        ),
        evidence=evidence_schema(timeline.evidence),
        limitations=list(timeline.limitations),
    )


def _earth(
    timeline: BodyTimeline, epochs: tuple[datetime, ...], step_s: float
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
        astronomical=_earth_summary(timeline.astronomical, epochs, step_s),
        terrain=_earth_summary(timeline.terrain, epochs, step_s) if timeline.terrain else None,
        evidence=evidence_schema(timeline.evidence),
        limitations=list(timeline.limitations),
    )


def _software() -> SoftwareProvenance:
    return SoftwareProvenance(
        service_version=__version__,
        components=[
            SoftwareComponent(name=c.name, version=c.version)
            for c in (*scientific_runtime(), *data_runtime())
        ],
    )


class TimelineService:
    """Illumination and Earth-visibility timelines (contract C4)."""

    def __init__(self, ephemeris: EphemerisService) -> None:
        self._ephemeris = ephemeris

    def _terrain_mask(self, site_id: str) -> HorizonMask | None:
        """Horizon mask for the site. None until S-TERRAIN's mask service (T-15) exists."""
        del site_id
        return None

    def timeline(self, request: TimelineRequest) -> TimelineAnalysis:
        geometry = self._ephemeris.compute_geometry(
            request.site_id, request.start_utc, request.end_utc, request.step_s, location="body"
        )
        mask = self._terrain_mask(geometry.site_id)
        sun = body_timeline(geometry.series[Body.SUN], mask)
        earth = body_timeline(geometry.series[Body.EARTH], mask)
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
            illumination=_illumination(sun, geometry.epochs, request.step_s),
            earth_visibility=_earth(earth, geometry.epochs, request.step_s),
            computed_at_utc=utc_now(),
            software=_software(),
        )


__all__ = ["TimelineService"]
