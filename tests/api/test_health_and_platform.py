"""Health, CORS, request ids, error envelope, runtime report, settings."""

from __future__ import annotations

from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from lunaris_api import __version__
from lunaris_api.app import create_app
from lunaris_api.settings import Settings
from tests.api.conftest import WEB_ORIGIN


def test_health_reports_status_and_version(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "lunaris-api"
    assert body["version"] == __version__
    assert body["api_version"] == "v1"
    assert body["environment"] == "test"
    assert datetime.fromisoformat(body["time_utc"]).utcoffset() is not None
    assert body["uptime_s"] >= 0
    assert {c["name"]: c["status"] for c in body["checks"]} == {
        "database": "ok",
        "data_directory": "ok",
        "dataset_registry": "ok",
    }


def test_health_degrades_when_data_directory_disappears(
    client: TestClient, settings: Settings
) -> None:
    # The lifespan creates data/state; remove the whole data root afterwards.
    state = settings.resolved_data_dir / "state"
    for path in sorted(state.rglob("*"), reverse=True):
        path.unlink() if path.is_file() else path.rmdir()
    state.rmdir()
    settings.resolved_data_dir.rmdir()
    response = client.get("/health")
    assert response.status_code == 503
    assert response.json()["status"] == "degraded"


def test_request_id_is_generated_and_echoed(client: TestClient) -> None:
    generated = client.get("/health").headers["x-request-id"]
    assert len(generated) == 32
    echoed = client.get("/health", headers={"X-Request-ID": "trace-abc.123"})
    assert echoed.headers["x-request-id"] == "trace-abc.123"
    # Unsafe ids are replaced, never reflected.
    replaced = client.get("/health", headers={"X-Request-ID": "bad id <script>"})
    assert replaced.headers["x-request-id"] != "bad id <script>"


def test_cors_allows_configured_origin_only(client: TestClient) -> None:
    preflight = client.options(
        "/api/v1/sites",
        headers={
            "Origin": WEB_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == WEB_ORIGIN

    simple = client.get("/health", headers={"Origin": WEB_ORIGIN})
    assert simple.headers["access-control-allow-origin"] == WEB_ORIGIN
    assert "x-request-id" in simple.headers["access-control-expose-headers"].lower()

    foreign = client.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in foreign.headers


def test_unknown_route_uses_error_envelope(client: TestClient) -> None:
    response = client.get("/api/v1/nope")
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "not_found"
    assert error["request_id"] == response.headers["x-request-id"]


def test_unexpected_errors_return_safe_500_with_cors(settings: Settings) -> None:
    app = create_app(settings)

    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError("secret internal detail")

    with TestClient(app) as test_client:
        response = test_client.get("/boom", headers={"Origin": WEB_ORIGIN})
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
    assert "secret" not in response.text
    assert response.headers["access-control-allow-origin"] == WEB_ORIGIN


def test_runtime_report_lists_scientific_toolchain(client: TestClient) -> None:
    body = client.get("/api/v1/system/runtime").json()
    components = {c["name"]: c for c in body["components"]}
    for name in ("numpy", "scipy", "spiceypy", "cspice", "rasterio", "gdal", "proj"):
        assert components[name]["available"], name
    assert body["api_version"] == "v1"


def test_cors_origins_parse_from_comma_separated_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LUNARIS_CORS_ORIGINS", "http://a.test:3000, https://b.test")
    assert Settings().cors_origins == ["http://a.test:3000", "https://b.test"]


@pytest.mark.parametrize("bad", ["*", "localhost:3000", "http://a.test/"])
def test_invalid_cors_origins_rejected(bad: str) -> None:
    with pytest.raises(ValidationError):
        Settings(cors_origins=[bad])


def test_docs_can_be_disabled(settings: Settings) -> None:
    locked = settings.model_copy(update={"docs_enabled": False})
    with TestClient(create_app(locked)) as test_client:
        assert test_client.get("/docs").status_code == 404
        assert test_client.get("/openapi.json").status_code == 404


def test_readiness_reports_missing_science_datasets(client: TestClient) -> None:
    # The test data directory is empty, so liveness is fine but analysis is not possible.
    assert client.get("/health").status_code == 200
    response = client.get("/health/ready")
    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "degraded"
    checks = {c["name"]: c for c in body["checks"]}
    assert checks["database"]["status"] == "ok"
    for dataset in ("naif-generic-kernels-lunar", "lola-ldem-75s-240m"):
        check = checks[f"dataset:{dataset}"]
        assert check["status"] == "unavailable"
        assert f"lunaris-data acquire {dataset}" in check["detail"]


def test_readiness_is_ok_once_the_datasets_are_acquired(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from lunaris_api.routers import health as health_router  # noqa: PLC0415
    from lunaris_data.store import DatasetStatus  # noqa: PLC0415

    class Acquired:
        status = DatasetStatus.ACQUIRED

    monkeypatch.setattr(health_router, "inspect_dataset", lambda manifest, layout: Acquired())
    response = client.get("/health/ready")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert [c["status"] for c in body["checks"]] == ["ok"] * 5
