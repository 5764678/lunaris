from __future__ import annotations

from pathlib import Path
from typing import Any

from sqlalchemy import Engine, create_engine, event, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from lunaris_api.db.models import Base


def make_engine(database_url: str) -> Engine:
    url = make_url(database_url)
    connect_args: dict[str, Any] = {}
    if url.get_backend_name() == "sqlite":
        # FastAPI runs sync endpoints in a thread pool.
        connect_args["check_same_thread"] = False
        if url.database and url.database != ":memory:":
            Path(url.database).parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(database_url, connect_args=connect_args, future=True)

    if url.get_backend_name() == "sqlite":

        @event.listens_for(engine, "connect")
        def _sqlite_pragmas(dbapi_connection: Any, _: Any) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.close()

    return engine


def make_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, expire_on_commit=False, future=True)


def create_schema(engine: Engine) -> None:
    """Create tables for development databases.

    Milestone 01 has no persisted data that must survive schema changes, so the schema
    is created directly. Alembic migrations will be introduced before any schema change
    that must preserve existing data.
    """
    Base.metadata.create_all(engine)


def check_database(engine: Engine) -> None:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))


def describe_database(database_url: str) -> str:
    """Credential-free description of the configured database for status output."""
    url = make_url(database_url)
    if url.get_backend_name() == "sqlite":
        return f"sqlite ({Path(url.database or ':memory:').name})"
    return f"{url.get_backend_name()} ({url.host or 'local'})"


__all__ = [
    "check_database",
    "create_schema",
    "describe_database",
    "make_engine",
    "make_session_factory",
]
