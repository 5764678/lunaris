"""Warm the caches of a baked demo image (run once at image build, see apps/api/Dockerfile).

Starts the API on a loopback port, registers the cited demo trio and requests the site
comparison once. That computes and caches the trio's horizon masks and PGDA 20 m windows
under LUNARIS_DATA_DIR, so the first visitor doesn't pay for them. A failed comparison is
reported but doesn't fail the build: uncached values are then computed on first request.
"""

from __future__ import annotations

import json
import subprocess
import sys
import time
import urllib.request

BASE = "http://127.0.0.1:8001"


def call(method: str, path: str, timeout: float = 600.0) -> object:
    # BASE is a fixed http://127.0.0.1 URL, so no user-controlled scheme reaches urlopen.
    request = urllib.request.Request(BASE + path, method=method)  # noqa: S310
    with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310
        return json.load(response)


def main() -> int:
    command = [sys.executable, "-m", "uvicorn", "lunaris_api.main:app", "--port", "8001"]
    server = subprocess.Popen(command)  # noqa: S603  (fixed argv, no external input)
    try:
        for _ in range(60):
            try:
                call("GET", "/health", timeout=2)
                break
            except OSError:
                time.sleep(1)
        else:
            print("prewarm: API did not start", file=sys.stderr)
            return 1
        trio = call("POST", "/api/v1/catalog/demo-trio/register")
        ids = ",".join(site["id"] for site in trio["sites"])  # type: ignore[index]
        print(f"prewarm: demo trio registered ({ids})")
        started = time.monotonic()
        try:
            table = call("GET", f"/api/v1/analysis/site-comparison?site_ids={ids}")
        except OSError as error:
            print(f"prewarm: site comparison failed ({error}); computed on first request instead")
            return 0
        rows = table["rows"]  # type: ignore[index]
        cells = [cell for row in rows for cell in row.values() if isinstance(cell, dict)]
        nulls = sum(1 for cell in cells if cell.get("value") is None)
        elapsed = time.monotonic() - started
        print(f"prewarm: comparison for {len(rows)} sites in {elapsed:.1f} s, {nulls} null cells")
        return 0
    finally:
        server.terminate()
        server.wait(timeout=30)


if __name__ == "__main__":
    raise SystemExit(main())
