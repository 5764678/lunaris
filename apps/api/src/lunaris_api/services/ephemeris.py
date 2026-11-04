"""Ephemeris use-cases: the verified SPICE kernel context for the API process.

The kernel set comes from the data store by manifest: every file of
``naif-generic-kernels-lunar`` is re-hashed against its acquisition record and the
SHA-256 pinned in the manifest before anything is furnished. Only then is a
:class:`~lunaris_science.geometry.spice.KernelSet` built from explicit paths.

CSPICE has one kernel pool per process, so the API keeps one
:class:`~lunaris_science.geometry.spice.SpiceContext` per process and reuses it.
"""

from __future__ import annotations

import threading
from datetime import datetime, timedelta

from lunaris_api.errors import ApiError
from lunaris_api.schemas.common import ErrorDetail, EvidenceSchema, SourceReferenceSchema
from lunaris_api.schemas.ephemeris import (
    MAX_EPHEMERIS_SAMPLES,
    BodyEphemeris,
    EphemerisObserver,
    EphemerisSample,
    SiteEphemeris,
)
from lunaris_api.services.sites import SiteService
from lunaris_data.manifest import DatasetManifest
from lunaris_data.registry import DatasetRegistry
from lunaris_data.store import DataLayout, read_record
from lunaris_data.validation.integrity import FileCheckResult, verify_dataset
from lunaris_science.constants import LOLA_REFERENCE_SPHERE_RADIUS
from lunaris_science.coordinates import CoordinateError, SelenographicCoordinate
from lunaris_science.geometry import (
    APPARENT_CORRECTION,
    Body,
    BodyGeometrySeries,
    GeometryError,
    ObserverSite,
    body_geometry,
    sample_count,
    uniform_utc_grid,
    utc_to_et,
)
from lunaris_science.geometry.spice import (
    KernelFile,
    KernelRole,
    KernelSet,
    SpiceContext,
)
from lunaris_science.provenance import Evidence, SourceReference

KERNEL_DATASET_ID = "naif-generic-kernels-lunar"


class KernelSetUnavailableError(RuntimeError):
    """The kernel set is missing, incomplete or fails checksum verification."""

    def __init__(self, dataset_id: str, problems: list[str]) -> None:
        self.dataset_id = dataset_id
        self.problems = problems
        super().__init__(
            f"kernel set {dataset_id!r} is not usable ({'; '.join(problems)}); "
            f"run `uv run lunaris-data acquire {dataset_id}`"
        )


def load_verified_kernel_set(manifest: DatasetManifest, layout: DataLayout) -> KernelSet:
    """Verify every kernel's SHA-256 and return the set with explicit absolute paths.

    Raises:
        KernelSetUnavailableError: if any file is missing, unrecorded or fails its checksum.
    """
    report = verify_dataset(manifest, layout)
    if not report.ok:
        problems = [
            f"{c.name}: {c.result.value}"
            for c in report.checks
            if c.result is not FileCheckResult.OK
        ]
        if not report.has_record:
            problems.insert(0, "no acquisition record")
        raise KernelSetUnavailableError(manifest.id, problems)

    directory = layout.dataset_dir(manifest)
    record = read_record(directory)
    files = []
    for spec in manifest.files:
        acquired = record.file(spec.name) if record else None
        if acquired is None:  # pragma: no cover - excluded by report.ok
            raise KernelSetUnavailableError(manifest.id, [f"{spec.name}: unrecorded"])
        files.append(
            KernelFile(
                role=KernelRole.from_file_name(spec.name),
                path=(directory / spec.name).resolve(),
                source=SourceReference(
                    source_id=f"{manifest.id}/{spec.name}",
                    title=spec.description or spec.name,
                    url=str(spec.url),
                    sha256=acquired.sha256,
                    citation=manifest.citation,
                ),
            )
        )
    return KernelSet(dataset_id=manifest.id, files=tuple(files))


_context_lock = threading.Lock()
_context_cache: dict[tuple[str, str], SpiceContext] = {}


def get_spice_context(manifest: DatasetManifest, layout: DataLayout) -> SpiceContext:
    """Return the process-wide context for this data root and manifest, loading it once."""
    key = (str(layout.root), manifest.fingerprint())
    with _context_lock:
        context = _context_cache.get(key)
        if context is not None and context.is_active:
            return context
        context = SpiceContext(load_verified_kernel_set(manifest, layout))
        _context_cache.clear()
        _context_cache[key] = context
        return context


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


def _evidence_schema(evidence: Evidence) -> EvidenceSchema:
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
        evidence=_evidence_schema(series.evidence),
    )


class EphemerisService:
    """Sun and Earth geometry for registered sites (contract C2)."""

    def __init__(self, sites: SiteService, registry: DatasetRegistry, layout: DataLayout) -> None:
        self._sites = sites
        self._registry = registry
        self._layout = layout

    def _context(self) -> SpiceContext:
        try:
            return get_spice_context(self._registry.get(KERNEL_DATASET_ID), self._layout)
        except KernelSetUnavailableError as exc:
            raise KernelsUnavailableError(
                "SPICE kernels are not available on this server. "
                f"An operator must run `uv run lunaris-data acquire {KERNEL_DATASET_ID}`."
            ) from exc

    def site_ephemeris(
        self, site_id: str, start_utc: datetime, end_utc: datetime, step_s: float
    ) -> SiteEphemeris:
        for name, value in (("start_utc", start_utc), ("end_utc", end_utc)):
            if value.utcoffset() != timedelta(0):
                raise EphemerisRequestError(
                    f"{name} must be UTC (suffix Z or +00:00)", ["query", name], "utc_required"
                )
        if end_utc < start_utc:
            raise EphemerisRequestError(
                "end_utc must not be earlier than start_utc", ["query", "end_utc"], "window_order"
            )
        count = sample_count(start_utc, end_utc, step_s)
        if count > MAX_EPHEMERIS_SAMPLES:
            raise EphemerisRequestError(
                f"the window and step give {count} samples; at most {MAX_EPHEMERIS_SAMPLES} "
                "are allowed per request. Increase step_s or shorten the window.",
                ["query", "step_s"],
                "sample_cap_exceeded",
            )

        site = self._sites.get_site(site_id)  # 404 for unknown ids
        try:
            observer = ObserverSite(
                SelenographicCoordinate(
                    site.coordinate.latitude_deg, site.coordinate.longitude_deg, None
                )
            )
        except CoordinateError as exc:
            raise EphemerisRequestError(
                str(exc), ["path", "site_id"], "topocentric_frame_undefined"
            ) from exc

        context = self._context()
        epochs = uniform_utc_grid(start_utc, end_utc, step_s)
        ets = utc_to_et(context, epochs)
        try:
            series = [body_geometry(context, body, observer, ets) for body in Body]
        except GeometryError as exc:
            raise EphemerisRequestError(
                f"{exc}. Kernel coverage: see docs/API.md.", ["query"], "outside_kernel_coverage"
            ) from exc

        return SiteEphemeris(
            site_id=site.id,
            site_name=site.name,
            observer=EphemerisObserver(
                latitude_deg=observer.coordinate.latitude_deg,
                longitude_deg=observer.coordinate.longitude_deg,
                frame="MOON_ME",
                reference_radius_m=LOLA_REFERENCE_SPHERE_RADIUS.value,
                surface_height_m=observer.coordinate.height_m,
                observer_height_m=observer.observer_height_m,
                radius_m=observer.radius_m,
            ),
            start_utc=start_utc,
            end_utc=end_utc,
            step_s=step_s,
            sample_count=len(epochs),
            max_samples=MAX_EPHEMERIS_SAMPLES,
            frame="MOON_ME",
            aberration_correction=APPARENT_CORRECTION,
            bodies=[_body_schema(s, epochs) for s in series],
            limitations=list(LIMITATIONS),
        )


__all__ = [
    "KERNEL_DATASET_ID",
    "EphemerisRequestError",
    "EphemerisService",
    "KernelSetUnavailableError",
    "KernelsUnavailableError",
    "get_spice_context",
    "load_verified_kernel_set",
]
