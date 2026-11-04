"""Start the real ASGI server (uvicorn) and exercise it over the loopback interface.

Complements the in-process TestClient suites: this proves the documented start command
works, the lifespan creates its state, and CORS behaves as a browser will see it.
"""

from __future__ import annotations

import os
import socket
import subprocess
import sys
import time
from collections.abc import Iterator
from pathlib import Path

import httpx
import pytest

pytestmark = pytest.mark.integration

WEB_ORIGIN = "http://localhost:3000"


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


@pytest.fixture(scope="module")
def live_api(tmp_path_factory: pytest.TempPathFactory) -> Iterator[str]:
    data_dir: Path = tmp_path_factory.mktemp("live-data")
    port = _free_port()
    env = {
        **os.environ,
        "LUNARIS_ENVIRONMENT": "test",
        "LUNARIS_DATA_DIR": str(data_dir),
        "LUNARIS_CORS_ORIGINS": WEB_ORIGIN,
        "LUNARIS_LOG_LEVEL": "WARNING",
    }
    process = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "lunaris_api.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
            "--no-access-log",
        ],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    base_url = f"http://127.0.0.1:{port}"
    try:
        deadline = time.monotonic() + 30
        with httpx.Client(trust_env=False, timeout=2.0) as client:
            while True:
                if process.poll() is not None:
                    output = process.stdout.read().decode() if process.stdout else ""
                    pytest.fail(f"uvicorn exited early ({process.returncode}):\n{output}")
                try:
                    if client.get(f"{base_url}/health").status_code == 200:
                        break
                except httpx.TransportError:
                    pass
                if time.monotonic() > deadline:
                    pytest.fail("uvicorn did not become healthy within 30 s")
                time.sleep(0.2)
        yield base_url
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
        if process.stdout:
            process.stdout.close()
    assert (data_dir / "state" / "lunaris.sqlite3").is_file()


@pytest.fixture
def http() -> Iterator[httpx.Client]:
    with httpx.Client(trust_env=False, timeout=5.0) as client:
        yield client


def test_health_over_http(live_api: str, http: httpx.Client) -> None:
    response = http.get(f"{live_api}/health", headers={"Origin": WEB_ORIGIN})
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.headers["access-control-allow-origin"] == WEB_ORIGIN


def test_browser_preflight_and_create_site(live_api: str, http: httpx.Client) -> None:
    preflight = http.options(
        f"{live_api}/api/v1/sites",
        headers={
            "Origin": WEB_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-request-id",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == WEB_ORIGIN

    created = http.post(
        f"{live_api}/api/v1/sites",
        json={"name": "Live integration site", "latitude_deg": -88.0, "longitude_deg": 45.0},
        headers={"Origin": WEB_ORIGIN, "X-Request-ID": "integration-1"},
    )
    assert created.status_code == 201
    assert created.headers["x-request-id"] == "integration-1"
    site_id = created.json()["id"]
    assert http.delete(f"{live_api}/api/v1/sites/{site_id}").status_code == 204


def test_openapi_served(live_api: str, http: httpx.Client) -> None:
    document = http.get(f"{live_api}/openapi.json").json()
    assert document["info"]["title"] == "LUNARIS API"
