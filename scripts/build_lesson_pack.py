"""Build the classroom lesson pack (contract L2 in ``docs/classroom/PLAN.md``, decision D10).

Writes ``apps/web/public/lesson-pack/v1/``:

* one JSON file per API response the lessons need, each the **unmodified response body**
  of the endpoint it stands for (the bytes the API sends), and
* ``manifest.json``: pack version, generation time, code commit, the request and window of
  every file, every source dataset the responses cite (id and SHA-256), and the SHA-256
  and byte size of every pack file.

The API runs **in process**: ``fastapi.testclient.TestClient`` drives the real application
(``lunaris_api.app.create_app``) through ASGI, with no HTTP server and no socket, so each
file is exactly what the API would return. Site registrations go to a throwaway SQLite file;
horizon masks and PGDA windows are cached in the data directory as the API normally does.

Needs the SPICE kernels and LDEM_75S_240M in the data store, and network access to the PGDA
20 m DEM (HTTP range requests) for the terrain metrics in the comparison.

Run: ``uv run python scripts/build_lesson_pack.py`` (optionally ``--data-dir``, ``--out``).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
import time
from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from lunaris_api.app import create_app
from lunaris_api.settings import Settings
from lunaris_data.kernels import KERNEL_DATASET_ID, get_spice_context
from lunaris_data.registry import DatasetRegistry
from lunaris_data.store import DataLayout
from lunaris_science.geometry import utc_to_et
from lunaris_science.geometry.moon_phase import PrincipalPhase, principal_phases

REPO = Path(__file__).resolve().parents[1]
DEFAULT_OUT = REPO / "apps/web/public/lesson-pack/v1"
PACK_VERSION = "1"
SIZE_BUDGET_BYTES = 3_000_000
HTTP_OK = 200

LUNATION_SEARCH_START = datetime(2027, 1, 1, tzinfo=UTC)
"""The pack covers the first full lunation (new Moon to new Moon) that starts in 2027."""
SERIES_STEP_S = 3600.0
COMPARISON_YEAR = 2027

MISSION_VARIANTS: dict[str, dict[str, str]] = {
    # Default request: no mission answers, so every need is "medium" (important), no limits.
    "default": {},
    "power-critical": {"power": "high", "comms": "none", "landing": "none"},
    "comms-critical": {"power": "none", "comms": "high", "landing": "none"},
    "landing-critical": {"power": "none", "comms": "none", "landing": "high"},
}
"""The four comparison variants the TD asked for (amended D9). "Critical" is the API value
``high`` (apps/web/src/lib/comparison/mission.ts labels it so); "none" is not needed."""


@dataclass
class PackFile:
    path: str
    endpoint: str
    method: str
    request: dict[str, Any]
    model: str
    window: dict[str, Any] | None
    body: bytes = field(repr=False)
    notes: str | None = None


def _iso(t: datetime) -> str:
    return t.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _code_commit() -> dict[str, Any]:
    def git(*args: str) -> str:
        return subprocess.run(  # noqa: S603  (fixed argv)
            ["git", *args],  # noqa: S607  (git from PATH, as every repo script uses)
            cwd=REPO,
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()

    commit = git("rev-parse", "HEAD")
    dirty = bool(git("status", "--porcelain", "--untracked-files=no", "--", ".", ":!apps/web"))
    return {"commit": commit, "dirty_outside_web": dirty}


def _lunation(data_dir: Path) -> dict[str, Any]:
    """The first full lunation starting in 2027, from the K-01 principal phases."""
    context = get_spice_context(
        DatasetRegistry.load_builtin().get(KERNEL_DATASET_ID), DataLayout.from_root(data_dir)
    )
    start_et, end_et = utc_to_et(
        context, [LUNATION_SEARCH_START, LUNATION_SEARCH_START + timedelta(days=70)]
    )
    events = principal_phases(context, float(start_et), float(end_et))
    with context.session():
        import spiceypy  # noqa: PLC0415  (only needed here, inside the SPICE lock)

        stamped = [
            (e.phase, datetime.fromisoformat(spiceypy.et2utc(e.epoch_et_s, "ISOC", 0)))
            for e in events
        ]
    new_moons = [t.replace(tzinfo=UTC) for p, t in stamped if p is PrincipalPhase.NEW_MOON]
    first, second = new_moons[0], new_moons[1]
    phases = [
        {"phase": p.value, "epoch_utc": _iso(t.replace(tzinfo=UTC))}
        for p, t in stamped
        if first <= t.replace(tzinfo=UTC) <= second
    ]
    # Hourly window covering the lunation: the hour at or before the first new Moon to the
    # hour at or after the next one.
    start = first.replace(minute=0, second=0)
    end = second.replace(minute=0, second=0)
    if end < second:
        end += timedelta(hours=1)
    return {
        "name": f"Lunation from the new Moon of {first:%d %B %Y}",
        "new_moon_utc": _iso(first),
        "next_new_moon_utc": _iso(second),
        "principal_phases": phases,
        "method": "lunaris_science.geometry.moon_phase.principal_phases (K-01, validated "
        "against JPL Horizons, docs/SCIENCE.md §5.2); instants rounded to the second.",
        "window": {"start_utc": _iso(start), "end_utc": _iso(end), "step_s": SERIES_STEP_S},
    }


class Builder:
    def __init__(self, client: TestClient) -> None:
        self.client = client
        self.files: list[PackFile] = []

    def get(self, path: str, endpoint: str, params: dict[str, Any], model: str, **kw: Any) -> Any:
        response = self.client.get(endpoint, params=params)
        if response.status_code != HTTP_OK:
            raise RuntimeError(f"GET {endpoint} {params} → {response.status_code}: {response.text}")
        self.files.append(
            PackFile(path, endpoint, "GET", {"query": params}, model, body=response.content, **kw)
        )
        return response.json()

    def post_json(
        self, path: str, endpoint: str, payload: dict[str, Any], model: str, **kw: Any
    ) -> Any:
        response = self.client.post(endpoint, json=payload)
        if response.status_code != HTTP_OK:
            raise RuntimeError(f"POST {endpoint} → {response.status_code}: {response.text}")
        self.files.append(
            PackFile(path, endpoint, "POST", {"json": payload}, model, body=response.content, **kw)
        )
        return response.json()


def _walk(node: Any) -> Iterator[dict[str, Any]]:
    if isinstance(node, dict):
        yield node
        for value in node.values():
            yield from _walk(value)
    elif isinstance(node, list):
        for value in node:
            yield from _walk(value)


def _cited_sources(files: list[PackFile]) -> list[dict[str, Any]]:
    """Every source reference any pack file cites, deduplicated (id, version, SHA-256, URL)."""
    seen: dict[tuple[Any, ...], dict[str, Any]] = {}
    for f in files:
        for node in _walk(json.loads(f.body)):
            if "source_id" in node and ("sha256" in node or "url" in node):
                key = (node.get("source_id"), node.get("sha256"), node.get("url"))
                entry = seen.setdefault(
                    key,
                    {
                        "source_id": node.get("source_id"),
                        "title": node.get("title"),
                        "version": node.get("version"),
                        "sha256": node.get("sha256"),
                        "url": node.get("url"),
                        "cited_by": [],
                    },
                )
                if f.path not in entry["cited_by"]:
                    entry["cited_by"].append(f.path)
    return sorted(seen.values(), key=lambda e: (str(e["source_id"]), str(e["url"])))


def _site_files(
    builder: Builder, catalog_id: str, site: dict[str, Any], lunation: dict[str, Any]
) -> dict[str, Any]:
    site_id = site["id"]
    window = lunation["window"]
    base = f"sites/{catalog_id}"
    builder.get(f"{base}/site.json", f"/api/v1/sites/{site_id}", {}, "CandidateSite", window=None)
    builder.get(
        f"{base}/horizon.json",
        f"/api/v1/sites/{site_id}/horizon",
        {},
        "HorizonMaskResponse",
        window=None,
    )
    timeline = builder.post_json(
        f"{base}/timeline.json",
        "/api/v1/analysis/timeline",
        {"site_id": site_id, **window},
        "TimelineAnalysis",
        window=window,
    )
    return {
        "catalog_site_id": catalog_id,
        "site_id": site_id,
        "name": site["name"],
        "files": [f"{base}/site.json", f"{base}/horizon.json", f"{base}/timeline.json"],
        "terrain_sunlit_fraction": (timeline["illumination"]["terrain"] or {}).get(
            "illuminated_fraction"
        ),
    }


def build(data_dir: Path, out: Path, *, scan_shadowed: bool) -> dict[str, Any]:
    started = time.monotonic()
    lunation = _lunation(data_dir)
    window = lunation["window"]
    with tempfile.TemporaryDirectory() as tmp:
        settings = Settings(
            environment="development",
            log_level="WARNING",
            data_dir=data_dir,
            database_url=f"sqlite:///{Path(tmp) / 'lesson-pack.sqlite3'}",
            docs_enabled=False,
        )
        with TestClient(create_app(settings)) as client:
            builder = Builder(client)
            builder.get(
                "ephemeris/sun.json",
                "/api/v1/ephemeris/sun",
                window,
                "SunDirectionSeries",
                window=window,
            )
            builder.get(
                "ephemeris/moon-phase.json",
                "/api/v1/ephemeris/moon-phase",
                window,
                "MoonPhaseSeries",
                window=window,
            )

            trio = client.post("/api/v1/catalog/demo-trio/register")
            trio.raise_for_status()
            catalog = client.get("/api/v1/catalog/sites").json()
            trio_ids = [s["id"] for s in catalog["sites"] if s["demo_trio"]]
            by_name = {s["name"]: s for s in trio.json()["sites"]}
            names = {s["id"]: s["name"] for s in catalog["sites"]}
            sites = [_site_files(builder, cid, by_name[names[cid]], lunation) for cid in trio_ids]

            compare_window = {
                "start_utc": f"{COMPARISON_YEAR}-01-01T00:00:00Z",
                "end_utc": f"{COMPARISON_YEAR + 1}-01-01T00:00:00Z",
                "step_s": SERIES_STEP_S,
            }
            site_ids = ",".join(s["site_id"] for s in sites)
            comparisons = []
            for variant, answers in MISSION_VARIANTS.items():
                path = f"compare/{variant}.json"
                builder.get(
                    path,
                    "/api/v1/analysis/site-comparison",
                    {"site_ids": site_ids, **answers},
                    "SiteComparison",
                    window=compare_window | {"source": "API default window (calendar 2027)"},
                )
                comparisons.append({"variant": variant, "mission_answers": answers, "file": path})

            shadowed: list[dict[str, Any]] = []
            scanned: list[dict[str, Any]] = []
            if scan_shadowed:
                for entry in catalog["sites"]:
                    if entry["demo_trio"]:
                        continue
                    reg = client.post(f"/api/v1/catalog/sites/{entry['id']}/register")
                    reg.raise_for_status()
                    response = client.post(
                        "/api/v1/analysis/timeline", json={"site_id": reg.json()["id"], **window}
                    )
                    response.raise_for_status()
                    terrain = response.json()["illumination"]["terrain"]
                    fraction = None if terrain is None else terrain["illuminated_fraction"]
                    scanned.append({"catalog_site_id": entry["id"], "sunlit_fraction": fraction})
                    if fraction == 0.0:
                        shadowed.append(_site_files(builder, entry["id"], reg.json(), lunation))

    out.mkdir(parents=True, exist_ok=True)
    for stale in out.rglob("*.json"):
        stale.unlink()
    entries = []
    for f in builder.files:
        target = out / f.path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(f.body)
        entries.append(
            {
                "path": f.path,
                "endpoint": f.endpoint,
                "method": f.method,
                "request": f.request,
                "model": f.model,
                "window": f.window,
                "bytes": len(f.body),
                "sha256": hashlib.sha256(f.body).hexdigest(),
            }
        )
    total = sum(e["bytes"] for e in entries)
    manifest = {
        "pack_version": PACK_VERSION,
        "generated_at_utc": _iso(datetime.now(UTC)),
        "generator": "scripts/build_lesson_pack.py",
        "code": _code_commit(),
        "lunation": lunation,
        "series_step_s": SERIES_STEP_S,
        "demo_trio": sites,
        "comparisons": comparisons,
        "permanently_shadowed_example": shadowed[0] if shadowed else None,
        "shadowed_scan": {
            "ran": scan_shadowed,
            "window": window,
            "criterion": "TimelineAnalysis.illumination.terrain.illuminated_fraction == 0",
            "sites": scanned,
        },
        "notes": [
            "Each file is the unmodified API response body; site ids and created_at_utc are "
            "assigned by the API at registration and differ between builds.",
            "Lessons find files through this manifest (catalog_site_id → files), not by site id.",
        ],
        "sources": _cited_sources(builder.files),
        "files": entries,
        "total_bytes": total,
        "size_budget_bytes": SIZE_BUDGET_BYTES,
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1) + "\n", encoding="utf-8")
    manifest["build_seconds"] = round(time.monotonic() - started, 1)
    return manifest


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--data-dir", type=Path, default=REPO / "data")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument(
        "--skip-shadowed-scan",
        action="store_true",
        help="Do not scan the other catalogue sites for a permanently shadowed example.",
    )
    args = parser.parse_args(argv)
    manifest = build(args.data_dir.resolve(), args.out, scan_shadowed=not args.skip_shadowed_scan)
    total = manifest["total_bytes"]
    print(
        f"lesson pack: {len(manifest['files'])} files, {total} bytes "
        f"({total / 1e6:.2f} MB; budget {SIZE_BUDGET_BYTES / 1e6:.0f} MB), "
        f"{manifest['build_seconds']} s"
    )
    print(
        f"lunation: {manifest['lunation']['new_moon_utc']} → "
        f"{manifest['lunation']['next_new_moon_utc']}"
    )
    shadowed = manifest["permanently_shadowed_example"]
    print(f"permanently shadowed example: {shadowed['name'] if shadowed else 'none found'}")
    return 0 if total <= SIZE_BUDGET_BYTES else 2


if __name__ == "__main__":
    sys.exit(main())
