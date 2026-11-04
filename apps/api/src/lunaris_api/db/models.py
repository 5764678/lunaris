"""SQLAlchemy ORM models. Persistence detail: never exposed outside ``lunaris_api.db``."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import CheckConstraint, DateTime, Float, String, Text, TypeDecorator
from sqlalchemy.engine import Dialect
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class UtcDateTime(TypeDecorator[datetime]):
    """Stores timezone-aware UTC datetimes; returns aware UTC datetimes on every backend
    (SQLite has no native timezone support)."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("naive datetimes are not allowed; use timezone-aware UTC")
        return value.astimezone(UTC)

    def process_result_value(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        if value is None:
            return None
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


class Base(DeclarativeBase):
    pass


class CandidateSiteRecord(Base):
    __tablename__ = "candidate_sites"
    __table_args__ = (
        CheckConstraint("latitude_deg >= -90 AND latitude_deg <= 90", name="ck_site_latitude"),
        CheckConstraint("longitude_deg >= 0 AND longitude_deg < 360", name="ck_site_longitude"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    name_key: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    latitude_deg: Mapped[float] = mapped_column(Float, nullable=False)
    longitude_deg: Mapped[float] = mapped_column(Float, nullable=False)
    frame: Mapped[str] = mapped_column(String(16), nullable=False)
    origin: Mapped[str] = mapped_column(String(32), nullable=False)
    reference: Mapped[str | None] = mapped_column(String(300))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at_utc: Mapped[datetime] = mapped_column(UtcDateTime(), nullable=False)


__all__ = ["Base", "CandidateSiteRecord", "UtcDateTime"]
