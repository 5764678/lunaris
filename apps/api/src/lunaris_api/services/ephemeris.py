"""Ephemeris use-cases: Sun and Earth geometry for registered sites (contract C2).

The verified kernel set and the per-process SPICE context come from
:mod:`lunaris_data.kernels`; this module only translates requests and results.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from lunaris_api.errors import ApiError
from lunaris_api.schemas.common import ErrorDetail, EvidenceSchema, SourceReferenceSchema
from lunaris_api.schemas.ephemeris import (
    MAX_EPHEMERIS_SAMPLES,
    BodyEphemeris,
    EphemerisObserver,
    EphemerisSample,
    MoonPhaseSample,
    MoonPhaseSeries,
    SiteEphemeris,
    SunDirectionSample,
    SunDirectionSeries,
)
from lunaris_api.schemas.sites import CandidateSite
from lunaris_api.services.sites import SiteService
from lunaris_data.kernels import KERNEL_DATASET_ID, KernelSetUnavailableError, get_spice_context
from lunaris_data.registry import DatasetRegistry
from lunaris_data.store import DataLayout
from lunaris_science.constants import LOLA_REFERENCE_SPHERE_RADIUS
from lunaris_science.coordinates import CoordinateError, SelenographicCoordinate
from lunaris_science.geometry import (
    APPARENT_CORRECTION,
    Body,
    BodyGeometrySeries,
    GeometryError,
    MoonCentredSeries,
    ObserverSite,
    body_geometry,
    moon_centred_direction,
    sample_count,
    uniform_utc_grid,
    utc_to_et,
)
from lunaris_science.geometry.moon_phase import (
    MOON_PHASE_LIMITATIONS,
    moon_phase_series,
)
from lunaris_science.geometry.moon_phase import MoonPhaseSeries as MoonPhaseResult
from lunaris_science.geometry.spice import SpiceContext
from lunaris_science.provenance import Evidence


class EphemerisRequestError(ApiError):
    """A well-formed request that cannot be served as asked (window, step, site)."""

    status_code = 422
    code = "validation_error"

    def __init__(self, message: str, location: list[str | int], error_type: str) -> None:
        super().__init__(
            message,
            details=[ErrorDetail(location=location, message=message, type=error_type)],
        )


class KernelsUnavailableError(ApiError):
    """The SPICE kernels are not acquired or fail verification on this server."""

    status_code = 503
    code = "kernels_unavailable"


LIMITATIONS = (
    "Elevations are relative to the astronomical horizon (the local horizontal plane of the "
    "reference sphere). Terrain is not considered: a body above 0° may still be hidden by "
    "terrain (see the illumination and visibility analyses).",
    "Earth geometry is geometric line of sight to the Earth's centre only; it does not imply "
    "a radio link.",
    "Directions are apparent (light time and stellar aberration); gravitational light "
    "deflection is not modelled (≤ 0.002 arcsec against JPL Horizons).",
)


def evidence_schema(evidence: Evidence) -> EvidenceSchema:
    return EvidenceSchema(
        kind=evidence.kind.value,
        statement=evidence.statement,
        sources=[
            SourceReferenceSchema(
                source_id=s.source_id,
                title=s.title,
                url=s.url,
                version=s.version,
                sha256=s.sha256,
                citation=s.citation,
            )
            for s in evidence.sources
        ],
        method=evidence.method,
        assumptions=list(evidence.assumptions),
    )


def _body_schema(series: BodyGeometrySeries, epochs: tuple[datetime, ...]) -> BodyEphemeris:
    directions = series.direction_moon_me.tolist()
    samples = [
        EphemerisSample(
            epoch_utc=epoch,
            azimuth_deg=az,
            elevation_deg=el,
            range_m=rng,
            angular_radius_deg=radius,
            direction_moon_me=direction,
        )
        for epoch, az, el, rng, radius, direction in zip(
            epochs,
            series.azimuth_deg.tolist(),
            series.elevation_deg.tolist(),
            series.range_m.tolist(),
            series.angular_radius_deg.tolist(),
            directions,
            strict=True,
        )
    ]
    return BodyEphemeris(
        body="sun" if series.body is Body.SUN else "earth",
        body_radius_m=series.body_radius_m,
        body_radii_m=list(series.body_radii_m),
        samples=samples,
        evidence=evidence_schema(series.evidence),
    )


@dataclass(frozen=True, slots=True)
class SiteGeometry:
    """Validated window plus Sun and Earth geometry for one site."""

    site_id: str
    site_name: str
    observer: ObserverSite
    epochs: tuple[datetime, ...]
    series: dict[Body, BodyGeometrySeries]
    window_end_utc: datetime
    window_end_et_s: float
    """End of the requested window in ET (the last epoch when it falls on a step)."""


def observer_schema(observer: ObserverSite) -> EphemerisObserver:
    return EphemerisObserver(
        latitude_deg=observer.coordinate.latitude_deg,
        longitude_deg=observer.coordinate.longitude_deg,
        frame="MOON_ME",
        reference_radius_m=LOLA_REFERENCE_SPHERE_RADIUS.value,
        surface_height_m=observer.coordinate.height_m,
        observer_height_m=observer.observer_height_m,
        radius_m=observer.radius_m,
    )


class EphemerisService:
    """Sun and Earth geometry for registered sites (contract C2)."""

    def __init__(self, sites: SiteService, registry: DatasetRegistry, layout: DataLayout) -> None:
        self._sites = sites
        self._registry = registry
        self._layout = layout

    @property
    def registry(self) -> DatasetRegistry:
        return self._registry

    def site(self, site_id: str) -> CandidateSite:
        """The registered site (404 for unknown ids)."""
        return self._sites.get_site(site_id)

    def _context(self) -> SpiceContext:
        try:
            return get_spice_context(self._registry.get(KERNEL_DATASET_ID), self._layout)
        except KernelSetUnavailableError as exc:
            raise KernelsUnavailableError(
                "SPICE kernels are not available on this server. "
                f"An operator must run `uv run lunaris-data acquire {KERNEL_DATASET_ID}`."
            ) from exc

    @staticmethod
    def _validate_window(
        start_utc: datetime, end_utc: datetime, step_s: float, location: str
    ) -> None:
        for name, value in (("start_utc", start_utc), ("end_utc", end_utc)):
            if value.utcoffset() != timedelta(0):
                raise EphemerisRequestError(
                    f"{name} must be UTC (suffix Z or +00:00)", [location, name], "utc_required"
                )
        if end_utc < start_utc:
            raise EphemerisRequestError(
                "end_utc must not be earlier than start_utc", [location, "end_utc"], "window_order"
            )
        count = sample_count(start_utc, end_utc, step_s)
        if count > MAX_EPHEMERIS_SAMPLES:
            raise EphemerisRequestError(
                f"the window and step give {count} samples; at most {MAX_EPHEMERIS_SAMPLES} "
                "are allowed per request. Increase step_s or shorten the window.",
                [location, "step_s"],
                "sample_cap_exceeded",
            )

    def compute_geometry(
        self,
        site_id: str,
        start_utc: datetime,
        end_utc: datetime,
        step_s: float,
        *,
        location: str = "query",
        surface_height_m: float | None = None,
        observer_height_m: float = 0.0,
    ) -> SiteGeometry:
        """Validate a window and compute Sun and Earth geometry for a registered site.

        ``location`` is the request part the window came from (``"query"`` or ``"body"``),
        used in error details. ``surface_height_m`` (DEM height above the reference sphere)
        and ``observer_height_m`` place the eye point (C2); without a surface height the
        site is on the sphere and the evidence says so. Raises the typed 404 / 422 / 503
        errors documented in docs/API.md.
        """
        self._validate_window(start_utc, end_utc, step_s, location)

        site = self._sites.get_site(site_id)  # 404 for unknown ids
        site_location: list[str | int] = (
            ["path", "site_id"] if location == "query" else [location, "site_id"]
        )
        try:
            observer = ObserverSite(
                SelenographicCoordinate(
                    site.coordinate.latitude_deg,
                    site.coordinate.longitude_deg,
                    surface_height_m,
                ),
                observer_height_m=observer_height_m,
            )
        except CoordinateError as exc:
            raise EphemerisRequestError(
                str(exc), site_location, "topocentric_frame_undefined"
            ) from exc

        context = self._context()
        epochs = uniform_utc_grid(start_utc, end_utc, step_s)
        ets = utc_to_et(context, epochs)
        window_end_et_s = float(utc_to_et(context, [end_utc])[0])
        try:
            series = {body: body_geometry(context, body, observer, ets) for body in Body}
        except GeometryError as exc:
            raise EphemerisRequestError(
                f"{exc}. Kernel coverage: see docs/API.md.", [location], "outside_kernel_coverage"
            ) from exc
        return SiteGeometry(
            site_id=site.id,
            site_name=site.name,
            observer=observer,
            epochs=epochs,
            series=series,
            window_end_utc=end_utc,
            window_end_et_s=window_end_et_s,
        )

    def sun_direction(
        self, start_utc: datetime, end_utc: datetime, step_s: float
    ) -> SunDirectionSeries:
        """Moon-centred apparent Sun direction, sub-solar point and angular radius (T-26)."""
        self._validate_window(start_utc, end_utc, step_s, "query")
        context = self._context()
        epochs = uniform_utc_grid(start_utc, end_utc, step_s)
        ets = utc_to_et(context, epochs)
        try:
            series = moon_centred_direction(context, Body.SUN, ets)
        except GeometryError as exc:
            raise EphemerisRequestError(
                f"{exc}. Kernel coverage: see docs/API.md.", ["query"], "outside_kernel_coverage"
            ) from exc
        return sun_direction_schema(series, epochs, start_utc, end_utc, step_s)

    def moon_phase(self, start_utc: datetime, end_utc: datetime, step_s: float) -> MoonPhaseSeries:
        """Geocentric Moon phase, Earth direction and sub-Earth point (K-01, contract L1)."""
        self._validate_window(start_utc, end_utc, step_s, "query")
        context = self._context()
        epochs = uniform_utc_grid(start_utc, end_utc, step_s)
        ets = utc_to_et(context, epochs)
        try:
            series = moon_phase_series(context, ets)
        except GeometryError as exc:
            raise EphemerisRequestError(
                f"{exc}. Kernel coverage: see docs/API.md.", ["query"], "outside_kernel_coverage"
            ) from exc
        return moon_phase_schema(series, epochs, start_utc, end_utc, step_s)

    def site_ephemeris(
        self, site_id: str, start_utc: datetime, end_utc: datetime, step_s: float
    ) -> SiteEphemeris:
        geometry = self.compute_geometry(site_id, start_utc, end_utc, step_s)
        return SiteEphemeris(
            site_id=geometry.site_id,
            site_name=geometry.site_name,
            observer=observer_schema(geometry.observer),
            start_utc=start_utc,
            end_utc=end_utc,
            step_s=step_s,
            sample_count=len(geometry.epochs),
            max_samples=MAX_EPHEMERIS_SAMPLES,
            frame="MOON_ME",
            aberration_correction=APPARENT_CORRECTION,
            bodies=[_body_schema(s, geometry.epochs) for s in geometry.series.values()],
            limitations=list(LIMITATIONS),
        )


def sun_direction_schema(
    series: MoonCentredSeries,
    epochs: tuple[datetime, ...],
    start: datetime,
    end: datetime,
    step_s: float,
) -> SunDirectionSeries:
    samples = [
        SunDirectionSample(
            epoch_utc=epoch,
            direction_moon_me=direction,
            subsolar_latitude_deg=lat,
            subsolar_longitude_deg=lon,
            angular_radius_deg=radius,
            range_m=rng,
        )
        for epoch, direction, lat, lon, radius, rng in zip(
            epochs,
            series.direction_moon_me.tolist(),
            series.subpoint_latitude_deg.tolist(),
            series.subpoint_longitude_deg.tolist(),
            series.angular_radius_deg.tolist(),
            series.range_m.tolist(),
            strict=True,
        )
    ]
    return SunDirectionSeries(
        start_utc=start,
        end_utc=end,
        step_s=step_s,
        sample_count=len(samples),
        max_samples=MAX_EPHEMERIS_SAMPLES,
        frame="MOON_ME",
        origin="MOON",
        aberration_correction=APPARENT_CORRECTION,
        sun_radius_m=series.body_radius_m,
        samples=samples,
        evidence=evidence_schema(series.evidence),
        limitations=list(SUN_DIRECTION_LIMITATIONS),
    )


def moon_phase_schema(
    series: MoonPhaseResult,
    epochs: tuple[datetime, ...],
    start: datetime,
    end: datetime,
    step_s: float,
) -> MoonPhaseSeries:
    samples = [
        MoonPhaseSample(
            epoch_utc=epoch,
            earth_direction_moon_me=direction,
            subearth_latitude_deg=lat,
            subearth_longitude_deg=lon,
            phase_angle_deg=phase,
            illuminated_fraction=fraction,
            elongation_deg=elongation,
            waxing=waxing,
        )
        for epoch, direction, lat, lon, phase, fraction, elongation, waxing in zip(
            epochs,
            series.earth.direction_moon_me.tolist(),
            series.earth.subpoint_latitude_deg.tolist(),
            series.earth.subpoint_longitude_deg.tolist(),
            series.phase_angle_deg.tolist(),
            series.illuminated_fraction.tolist(),
            series.elongation_deg.tolist(),
            series.waxing.tolist(),
            strict=True,
        )
    ]
    return MoonPhaseSeries(
        start_utc=start,
        end_utc=end,
        step_s=step_s,
        sample_count=len(samples),
        max_samples=MAX_EPHEMERIS_SAMPLES,
        frame="MOON_ME",
        origin="MOON",
        viewpoint="geocentric",
        aberration_correction=APPARENT_CORRECTION,
        samples=samples,
        evidence=evidence_schema(series.evidence),
        limitations=list(MOON_PHASE_LIMITATIONS),
    )


SUN_DIRECTION_LIMITATIONS = (
    "Moon-centred direction: from a surface point the Sun's direction differs by at most "
    "R_moon / range (about 2.4 arcsec). Use the site ephemeris for topocentric azimuth and "
    "elevation.",
    "Lighting the whole globe from this direction is the illumination of a smooth sphere; "
    "terrain shadows need the terrain horizon (POST /api/v1/analysis/timeline).",
    "Apparent direction (light time and stellar aberration at the Moon's centre); "
    "gravitational light deflection is not modelled.",
)


__all__ = [
    "EphemerisRequestError",
    "EphemerisService",
    "KernelsUnavailableError",
    "SiteGeometry",
    "evidence_schema",
    "moon_phase_schema",
    "observer_schema",
]
