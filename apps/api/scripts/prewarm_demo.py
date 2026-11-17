"""Warm the caches of a baked demo image (run once at image build, see apps/api/Dockerfile).

Starts the API on a loopback port with timeline baking switched on, makes sure the cited sites
are registered (the demo trio, plus all 27 when ``LUNARIS_SEED_CATALOG`` is set) and requests the
site comparison for each site once. That computes and caches each site's horizon mask and PGDA
20 m window under LUNARIS_DATA_DIR and bakes its default-window (calendar 2027, hourly) timeline
to ``<data>/processed/timelines/``, where the running API serves it without computing. A site that
fails is reported and skipped, and a failed prewarm never fails the build: whatever is missing is
computed on first request instead.
"""

from __future__ import annotations

import json
import os
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
    # Only this process bakes timelines; the service that runs from the image never writes them.
    server = subprocess.Popen(  # noqa: S603  (fixed argv, no external input)
        command, env={**os.environ, "LUNARIS_BAKE_TIMELINES": "true"}
    )
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
        call("POST", "/api/v1/catalog/demo-trio/register")  # no-op when the catalogue is seeded
        sites = call("GET", "/api/v1/sites")["sites"]  # type: ignore[index]
        print(f"prewarm: {len(sites)} sites registered")
        started = time.monotonic()
        done = 0
        for site in sites:
            site_started = time.monotonic()
            try:
                table = call("GET", f"/api/v1/analysis/site-comparison?site_ids={site['id']}")
            except OSError as error:
                print(f"prewarm: skip {site['name']} ({error}); computed on first request instead")
                continue
            done += 1
            row = table["rows"][0]  # type: ignore[index]
            nulls = sum(
                1 for cell in row.values() if isinstance(cell, dict) and cell.get("value") is None
            )
            seconds = time.monotonic() - site_started
            print(f"prewarm: {site['name']} in {seconds:.1f} s, {nulls} null cells")
        print(f"prewarm: {done}/{len(sites)} sites in {time.monotonic() - started:.0f} s")
        return 0
    finally:
        server.terminate()
        server.wait(timeout=30)


if __name__ == "__main__":
    raise SystemExit(main())
