# LUNARIS

**Lunar Mission Intelligence & Surface Operations Platform** — an integrated scientific
and engineering platform for lunar mission planning, built on real NASA datasets, with
an eye toward surface operations.

LUNARIS treats the Moon as an operational environment. Its goal is to answer, with
traceable evidence: *Is this landing site physically suitable? How does its illumination
change over time? When is the Earth geometrically visible? Does terrain obstruct the Sun
or the Earth? How do candidate sites compare, and what are the trade-offs?*

> **Status: Milestone 01 — foundation.** Architecture, data provenance, API, contracts
> and the mission-control client are in place. Terrain, geometry, illumination and
> visibility analyses are **not implemented yet**; the UI marks every such value as not
> computed. LUNARIS is a preliminary planning and research tool, **not a certified
> spacecraft landing system**.

![LUNARIS mission overview](docs/images/mission-overview.jpg)

*Mission overview with the NASA SVS CGI Moon Kit color map, acquired with `lunaris-data`.
A fresh clone shows a clearly labeled procedural placeholder surface until the data is
acquired (commands below). Lighting is view-relative and labeled as such; the site is
user-defined.*

## What works in Milestone 01

- **Mission-control web client** (Next.js 16, React 19, Tailwind v4, shadcn/ui, React
  Three Fiber): module navigation, live API status, UTC clock, 3D lunar globe in the
  `MOON_ME` frame (south-polar views, graticule, selectable site markers), mission panel,
  analysis timeline with time controls, data-sources page.
- **Candidate sites** (user-defined): create/list/select/delete, validated on both sides,
  persisted in SQLite, shown on the globe.
- **FastAPI backend**: `GET /health`, toolchain report, dataset registry with local
  provenance status, sites API; uniform error envelope, request ids, CORS.
- **Reproducible data acquisition**: manifests for LOLA GDR, NAIF lunar SPICE kernels and
  the SVS CGI Moon Kit — URLs verified and SHA-256 pinned; acquisition records; integrity
  verification. Proven against the real NASA archives: all three datasets acquired and
  verified with matching checksums.
- **Contracts**: TypeScript types generated from the API's OpenAPI document, drift-checked
  in CI; draft contracts for future modules.
- **Tests**: 117 Python tests (science, data, API, live-server integration), 42 web unit
  tests, 4 Playwright end-to-end tests.

## Repository layout

```
apps/
  api/                FastAPI application (lunaris-api)
  web/                Next.js mission-control client (@lunaris/web)
packages/
  science/            lunaris-science — pure scientific core (no I/O)
  data/               lunaris-data — manifests, acquisition, integrity, preprocessing, CLI
  shared-types/       @lunaris/shared-types — OpenAPI-generated + draft contract types
data/                 local data store (git-ignored contents): raw/ kernels/ processed/ state/ fixtures/
tests/                science/ data/ api/ integration/ (incl. e2e/ Playwright specs)
docs/                 ARCHITECTURE · SCIENCE · DATA_SOURCES · API · ROADMAP
scripts/dev.mjs       runs API + web together
```

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | ≥ 20.9 (tested 22) | npm ≥ 10 |
| Python | ≥ 3.11 (tested 3.11 in CI, 3.12, 3.13) | |
| [uv](https://docs.astral.sh/uv/) | ≥ 0.5 (tested 0.11) | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |

GDAL (via rasterio) and CSPICE (via SpiceyPy) install as binary wheels; no system
libraries are needed.

## Setup

```bash
npm install          # JavaScript workspaces (web + shared-types)
uv sync              # Python workspace into .venv (uses uv.lock)
cp .env.example .env # optional; defaults work for local development
```

## Run

```bash
npm run dev          # API on http://localhost:8000 and web on http://localhost:3000
```

Or separately: `npm run dev:api` and `npm run dev:web`. API docs: <http://localhost:8000/docs>.

Production build of the web client: `npm run build && npm run start:web`.

### Acquire NASA data (requires access to NASA archive hosts)

```bash
uv run lunaris-data list                                # registry + local status
uv run lunaris-data acquire naif-generic-kernels-lunar  # ~45 MB SPICE kernels
uv run lunaris-data acquire lola-ldem-75s-240m          # ~29 MB LOLA DEM
uv run lunaris-data acquire nasa-svs-cgi-moon-kit       # ~13 MB color map (visualization)
uv run lunaris-data build-web-texture                   # globe switches to the NASA texture
uv run lunaris-data verify lola-ldem-75s-240m           # re-hash against the record
```

### Docker

```bash
docker compose up --build    # API :8000, web :3000; ./data is bind-mounted
```

## Test and check

```bash
npm run check          # lint + format + typecheck + contract drift + all unit/integration tests
uv run pytest          # Python: science, data, API, live uvicorn integration
npm run test:web       # web unit tests (Vitest)
npx playwright install chromium --with-deps   # once, from apps/web
npm run test:e2e       # browser end-to-end against a real API + web server
npm run contracts:generate   # after changing API schemas
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `LUNARIS_ENVIRONMENT` | `development` | `development` · `test` · `production` |
| `LUNARIS_LOG_LEVEL` | `INFO` | API log level |
| `LUNARIS_CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Explicit browser origins (no wildcards) |
| `LUNARIS_DATA_DIR` | `./data` | Local data store root |
| `LUNARIS_DATABASE_URL` | SQLite in `<data>/state/` | SQLAlchemy URL |
| `LUNARIS_DOCS_ENABLED` | `true` | Serve `/docs`, `/redoc`, `/openapi.json` |
| `NEXT_PUBLIC_LUNARIS_API_URL` | `http://localhost:8000` | API base URL for the browser (inlined at build time) |

No secrets are required. Never put secrets in `NEXT_PUBLIC_*` variables.

## Known warnings

- Without an acquired texture, the browser console shows one **404 for
  `/textures/moon/manifest.json`** — that is the placeholder fallback working as designed.
- **`THREE.Clock: This module has been deprecated`** is emitted inside
  `@react-three/fiber` 9.8 with three.js r187; it is harmless and will disappear with an
  upstream update.
- `npm audit` reports moderate advisories in the **ESLint toolchain** (`minimatch`), a
  development-only dependency that is not shipped to browsers.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — packages, dependency rules, contracts, decisions
- [Science](docs/SCIENCE.md) — conventions, implemented calculations, planned methods, validation
- [Data sources](docs/DATA_SOURCES.md) — datasets, provenance rules, verification
- [API](docs/API.md) — endpoints and conventions
- [Roadmap](docs/ROADMAP.md) — milestones, including the future LUNARIS FIELD research track
- [Decisions](docs/DECISIONS.md) — accepted architectural decision records

## Data credits

NASA PDS Geosciences Node (LRO LOLA), NASA NAIF (SPICE), NASA Scientific Visualization
Studio (CGI Moon Kit), JPL Solar System Dynamics (Horizons). See
[docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) for full citations.
