"""Cited site catalogue use-cases (T-03)."""

from __future__ import annotations

from lunaris_api.errors import ConflictError, NotFoundError
from lunaris_api.schemas.catalog import (
    CatalogReferencePointSchema,
    CatalogSiteSchema,
    CatalogSourceSchema,
    CatalogTileSchema,
    RegisteredCatalogSites,
    SiteCatalogResponse,
)
from lunaris_api.schemas.sites import CandidateSite
from lunaris_api.services.sites import SiteService
from lunaris_data.catalogs.sites import CatalogSite, SiteCatalog

PREFIX = "/api/v1/catalog"


def _notes(catalog: SiteCatalog, entry: CatalogSite) -> str:
    region = (
        f" NASA Artemis III candidate region (2022): {entry.artemis_iii_2022_region}."
        if entry.artemis_iii_2022_region
        else ""
    )
    return (
        f"Catalogue {catalog.id} entry {entry.id} (PGDA {entry.pgda_site_id}).{region} "
        f"Reference point: {catalog.reference_point_definition}"
    )[:1000]


class CatalogService:
    def __init__(self, catalog: SiteCatalog, sites: SiteService) -> None:
        self._catalog = catalog
        self._sites = sites

    def catalog(self) -> SiteCatalogResponse:
        c = self._catalog
        return SiteCatalogResponse(
            id=c.id,
            title=c.title,
            evidence_kind=c.evidence_kind,
            reference_point_definition=c.reference_point_definition,
            method=c.method,
            retrieved_on=c.retrieved_on,
            citation=c.citation,
            sources=[
                CatalogSourceSchema(title=s.title, url=str(s.url), use=s.use) for s in c.sources
            ],
            limitations=list(c.limitations),
            sites=[
                CatalogSiteSchema(
                    id=e.id,
                    name=e.name,
                    pgda_site_id=e.pgda_site_id,
                    artemis_iii_2022_region=e.artemis_iii_2022_region,
                    demo_trio=e.demo_trio,
                    reference_point=CatalogReferencePointSchema.model_validate(
                        e.reference_point.model_dump()
                    ),
                    tile=CatalogTileSchema.model_validate(e.tile.model_dump(mode="json")),
                    register_url=f"{PREFIX}/sites/{e.id}/register",
                )
                for e in c.sites
            ],
            count=len(c.sites),
            demo_trio_register_url=f"{PREFIX}/demo-trio/register",
        )

    def _register(self, entry: CatalogSite) -> CandidateSite:
        return self._sites.create_published_site(
            name=entry.name,
            latitude_deg=entry.reference_point.latitude_deg,
            longitude_deg=entry.reference_point.longitude_deg,
            reference=f"{self._catalog.citation}; tile {entry.pgda_site_id}",
            notes=_notes(self._catalog, entry),
        )

    def register(self, catalog_site_id: str) -> CandidateSite:
        try:
            entry = self._catalog.site(catalog_site_id)
        except KeyError:
            raise NotFoundError(f"Catalogue site {catalog_site_id!r} does not exist.") from None
        if self._sites.find_by_name(entry.name) is not None:
            raise ConflictError(f"A site named {entry.name!r} is already registered.")
        return self._register(entry)

    def register_demo_trio(self) -> RegisteredCatalogSites:
        """Register the three demo sites; ones already present (same name) are reused."""
        sites, created, existing = [], [], []
        for entry in (e for e in self._catalog.sites if e.demo_trio):
            found = self._sites.find_by_name(entry.name)
            if found is not None:
                sites.append(found)
                existing.append(entry.id)
            else:
                sites.append(self._register(entry))
                created.append(entry.id)
        return RegisteredCatalogSites(sites=sites, created=created, already_registered=existing)


__all__ = ["CatalogService"]
