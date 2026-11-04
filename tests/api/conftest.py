from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from lunaris_api.app import create_app
from lunaris_api.settings import Settings

WEB_ORIGIN = "http://localhost:3000"


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        environment="test",
        data_dir=tmp_path / "data",
        cors_origins=[WEB_ORIGIN],
        log_level="WARNING",
    )


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    with TestClient(create_app(settings)) as test_client:
        yield test_client
