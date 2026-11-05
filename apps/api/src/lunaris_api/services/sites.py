"""Candidate site registry use-cases."""

from __future__ import annotations

import uuid

from lunaris_api.db.repositories import (
    DuplicateSiteNameError,
    SiteEntity,
    SiteRepository,
    name_key,
)
from lunaris_api.errors import ConflictError, NotFoundError
from lunaris_api.schemas.common import EvidenceSchema, SourceReferenceSchema
from lunaris_api.schemas.sites import (
    BodyFixedPositionSchema,
    CandidateSite,
    CandidateSiteCreate,
    CandidateSiteList,
    SelenographicCoordinateSchema,
)
from lunaris_data.store import utc_now
from lunaris_science.constants import LOLA_REFERENCE_SPHERE_RADIUS
from lunaris_science.coordinates import SelenographicCoordinate, spherical_to_cartesian
from lunaris_science.frames import CANONICAL_FRAME
from lunaris_science.provenance import Evidence, EvidenceKind, SourceReference

MAX_SITES = 250
"""Upper bound on registry size: keeps list responses bounded in Milestone 01."""

ORIGIN_USER_DEFINED = "user_defined"
ORIGIN_PUBLISHED = "published"

_REFERENCE_RADIUS_SOURCE = SourceReference(
    source_id="constant:lola-reference-sphere-radius",
    title="LOLA reference sphere radius (1737.4 km)",
    citation=LOLA_REFERENCE_SPHERE_RADIUS.source,
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


def body_fixed_position(entity: SiteEntity) -> BodyFixedPositionSchema:
    """Position of the site on the reference sphere, with explicit evidence.

    The height above the reference sphere has not been sampled from a DEM in Milestone 01,
    so the calculation states the h = 0 m assumption instead of hiding it.
    """
    radius_m = LOLA_REFERENCE_SPHERE_RADIUS.value
    x_m, y_m, z_m = (
        float(v)
        for v in spherical_to_cartesian(entity.latitude_deg, entity.longitude_deg, radius_m)
    )
    evidence = Evidence(
        kind=EvidenceKind.CALCULATION,
        statement="Body-fixed Cartesian position of the site on the reference sphere.",
        sources=(_REFERENCE_RADIUS_SOURCE,),
        method="lunaris_science.coordinates.spherical_to_cartesian (planetocentric → MOON_ME)",
        assumptions=(
            "Height above the reference sphere not sampled; h = 0 m assumed.",
            "Coordinates are user-defined planetocentric MOON_ME values."
            if entity.origin == ORIGIN_USER_DEFINED
            else "Coordinates are the published catalogue reference point (planetocentric, "
            "MOON_ME); see the site's reference and notes.",
        ),
    )
    return BodyFixedPositionSchema(
        x_m=x_m,
        y_m=y_m,
        z_m=z_m,
        frame="MOON_ME",
        reference_radius_m=radius_m,
        evidence=_evidence_schema(evidence),
    )


def to_schema(entity: SiteEntity) -> CandidateSite:
    return CandidateSite(
        id=entity.id,
        name=entity.name,
        coordinate=SelenographicCoordinateSchema(
            latitude_deg=entity.latitude_deg,
            longitude_deg=entity.longitude_deg,
            frame="MOON_ME",
        ),
        origin=ORIGIN_PUBLISHED if entity.origin == ORIGIN_PUBLISHED else ORIGIN_USER_DEFINED,
        reference=entity.reference,
        notes=entity.notes,
        created_at_utc=entity.created_at_utc,
        body_fixed_position=body_fixed_position(entity),
    )


class SiteService:
    def __init__(self, repository: SiteRepository) -> None:
        self._repository = repository

    def list_sites(self) -> CandidateSiteList:
        sites = [to_schema(e) for e in self._repository.list_all()]
        return CandidateSiteList(sites=sites, count=len(sites), limit=MAX_SITES)

    def get_site(self, site_id: str) -> CandidateSite:
        entity = self._repository.get(site_id)
        if entity is None:
            raise NotFoundError(f"Candidate site {site_id!r} does not exist.")
        return to_schema(entity)

    def create_site(self, payload: CandidateSiteCreate) -> CandidateSite:
        return self._add(
            name=payload.name,
            latitude_deg=payload.latitude_deg,
            longitude_deg=payload.longitude_deg,
            origin=ORIGIN_USER_DEFINED,
            reference=payload.reference or None,
            notes=payload.notes or None,
        )

    def create_published_site(
        self, *, name: str, latitude_deg: float, longitude_deg: float, reference: str, notes: str
    ) -> CandidateSite:
        """Register a site from the cited catalogue (origin ``published``)."""
        return self._add(
            name=name,
            latitude_deg=latitude_deg,
            longitude_deg=longitude_deg,
            origin=ORIGIN_PUBLISHED,
            reference=reference,
            notes=notes,
        )

    def find_by_name(self, name: str) -> CandidateSite | None:
        key = name_key(name)
        for entity in self._repository.list_all():
            if name_key(entity.name) == key:
                return to_schema(entity)
        return None

    def _add(
        self,
        *,
        name: str,
        latitude_deg: float,
        longitude_deg: float,
        origin: str,
        reference: str | None,
        notes: str | None,
    ) -> CandidateSite:
        if self._repository.count() >= MAX_SITES:
            raise ConflictError(f"The site registry is limited to {MAX_SITES} sites.")
        # Validation + normalization by the scientific core (longitude → [0, 360)).
        coordinate = SelenographicCoordinate(latitude_deg, longitude_deg)
        entity = SiteEntity(
            id=str(uuid.uuid4()),
            name=" ".join(name.split()),
            latitude_deg=coordinate.latitude_deg,
            longitude_deg=coordinate.longitude_deg,
            frame=CANONICAL_FRAME.value,
            origin=origin,
            reference=reference,
            notes=notes,
            created_at_utc=utc_now(),
        )
        try:
            stored = self._repository.add(entity)
        except DuplicateSiteNameError:
            raise ConflictError(f"A site named {entity.name!r} already exists.") from None
        return to_schema(stored)

    def delete_site(self, site_id: str) -> None:
        if not self._repository.delete(site_id):
            raise NotFoundError(f"Candidate site {site_id!r} does not exist.")


__all__ = ["MAX_SITES", "SiteService", "body_fixed_position", "to_schema"]
