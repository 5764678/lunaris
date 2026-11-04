"""Persistence layer.

SQLAlchemy 2.x keeps the application independent of the database engine: SQLite is
used for lightweight development persistence, and a server database (for example
PostgreSQL/PostGIS) can be adopted later by changing ``LUNARIS_DATABASE_URL`` and
introducing schema migrations (Alembic). Routers and services depend on repository
*protocols*, never on SQLAlchemy sessions directly.
"""
