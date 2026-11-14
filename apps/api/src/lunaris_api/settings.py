"""Runtime configuration from environment variables (prefix ``LUNARIS_``) and ``.env``."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="LUNARIS_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: Literal["development", "test", "production"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"]
    )
    data_dir: Path = Path("data")
    database_url: str | None = None
    docs_enabled: bool = True
    # On a public demo, set LUNARIS_PROTECT_PUBLISHED_SITES=true so visitors cannot delete the cited
    # (published) sites: the API answers 403, and they stay registered until the service restarts.
    protect_published_sites: bool = False
    # Register all 27 cited catalogue sites (PGDA product 78) when the API starts. Idempotent: sites
    # already registered, or deleted by a visitor, are only re-added on the next start.
    seed_catalog: bool = False

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("cors_origins")
    @classmethod
    def _validate_origins(cls, origins: list[str]) -> list[str]:
        for origin in origins:
            if origin == "*":
                raise ValueError("wildcard CORS origin is not allowed; list origins explicitly")
            if not origin.startswith(("http://", "https://")) or origin.endswith("/"):
                raise ValueError(f"invalid CORS origin {origin!r} (expected scheme://host[:port])")
        return origins

    @property
    def resolved_data_dir(self) -> Path:
        return self.data_dir.expanduser().resolve()

    @property
    def resolved_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        return f"sqlite:///{self.resolved_data_dir / 'state' / 'lunaris.sqlite3'}"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


__all__ = ["Settings", "get_settings"]
