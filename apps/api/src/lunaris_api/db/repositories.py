"""Repository protocol and SQLAlchemy implementation for candidate sites."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from lunaris_api.db.models import CandidateSiteRecord


class DuplicateSiteNameError(Exception):
    """A site with the same (case-insensitive) name already exists."""


@dataclass(frozen=True, slots=True)
class SiteEntity:
    id: str
    name: str
    latitude_deg: float
    longitude_deg: float
    frame: str
    origin: str
    reference: str | None
    notes: str | None
    created_at_utc: datetime


def name_key(name: str) -> str:
    return " ".join(name.split()).casefold()


class SiteRepository(Protocol):
    def list_all(self) -> list[SiteEntity]: ...
    def get(self, site_id: str) -> SiteEntity | None: ...
    def count(self) -> int: ...
    def add(self, site: SiteEntity) -> SiteEntity: ...
    def delete(self, site_id: str) -> bool: ...


def _to_entity(record: CandidateSiteRecord) -> SiteEntity:
    return SiteEntity(
        id=record.id,
        name=record.name,
        latitude_deg=record.latitude_deg,
        longitude_deg=record.longitude_deg,
        frame=record.frame,
        origin=record.origin,
        reference=record.reference,
        notes=record.notes,
        created_at_utc=record.created_at_utc,
    )


class SqlAlchemySiteRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_all(self) -> list[SiteEntity]:
        rows = self._session.scalars(
            select(CandidateSiteRecord).order_by(
                CandidateSiteRecord.created_at_utc, CandidateSiteRecord.id
            )
        )
        return [_to_entity(row) for row in rows]

    def get(self, site_id: str) -> SiteEntity | None:
        record = self._session.get(CandidateSiteRecord, site_id)
        return _to_entity(record) if record else None

    def count(self) -> int:
        return int(self._session.scalar(select(func.count()).select_from(CandidateSiteRecord)) or 0)

    def add(self, site: SiteEntity) -> SiteEntity:
        record = CandidateSiteRecord(
            id=site.id,
            name=site.name,
            name_key=name_key(site.name),
            latitude_deg=site.latitude_deg,
            longitude_deg=site.longitude_deg,
            frame=site.frame,
            origin=site.origin,
            reference=site.reference,
            notes=site.notes,
            created_at_utc=site.created_at_utc,
        )
        self._session.add(record)
        try:
            self._session.commit()
        except IntegrityError as exc:
            self._session.rollback()
            raise DuplicateSiteNameError(site.name) from exc
        return _to_entity(record)

    def delete(self, site_id: str) -> bool:
        record = self._session.get(CandidateSiteRecord, site_id)
        if record is None:
            return False
        self._session.delete(record)
        self._session.commit()
        return True


__all__ = [
    "DuplicateSiteNameError",
    "SiteEntity",
    "SiteRepository",
    "SqlAlchemySiteRepository",
    "name_key",
]
