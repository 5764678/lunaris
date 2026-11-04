# LUNARIS — Architecture

LUNARIS is a **modular monolith**: one web client, one API process, and pure libraries
with strict dependency direction. No microservices; subsystem boundaries are package
boundaries.

```
 Browser
   │  HTTPS / JSON (snake_case, units in field names, ISO-8601 UTC)
   ▼
 apps/web  (Next.js 16, React 19, R3F)          apps/api  (FastAPI)
 ─────────────────────────────────────          ───────────────────────────────────────
 App shell · mission panel · timeline   ──────▶ routers ─▶ services ─▶ repositories ─▶ SQLite
 3D viewport (WebGL)                     CORS     │            │                        (SQLAlchemy)
 typed API client + TanStack Query               │            ├──▶ lunaris-data   (manifests, acquisition,
       ▲                                         │            │                     integrity, preprocessing)
       │ generated types                         │            └──▶ lunaris-science (pure computation)
 packages/shared-types ◀── openapi-typescript ◀── OpenAPI document
                                                               lunaris-data ──▶ data/ (raw, kernels, processed)
```

## 1. Packages and responsibilities

| Package | Language | Responsibility | May depend on |
| --- | --- | --- | --- |
| `packages/science` → `lunaris-science` | Python | Pure scientific core: constants, frames, coordinates, provenance/evidence model, toolchain report; future terrain/geometry/illumination/visibility/energy/scoring | numpy, scipy, spiceypy |
| `packages/data` → `lunaris-data` | Python | Dataset manifests, registry, local store layout, acquisition with provenance records, integrity verification, preprocessing; `lunaris-data` CLI | lunaris-science, pydantic, httpx, rasterio |
| `apps/api` → `lunaris-api` | Python | HTTP transport: validation, errors, CORS, request ids, persistence, OpenAPI | lunaris-science, lunaris-data, FastAPI, SQLAlchemy |
| `packages/shared-types` → `@lunaris/shared-types` | TypeScript | Contract types: generated from OpenAPI + documented draft contracts for future modules | — |
| `apps/web` → `@lunaris/web` | TypeScript | Mission-control UI and 3D visualization | shared-types |

**Rules.**

- `lunaris-science` performs **no I/O**: no network, no implicit file access, no web
  imports. Functions take arrays and explicit parameters and return values plus
  `Evidence`. This keeps computations deterministic and testable.
- `lunaris-data` owns every byte that comes from outside (downloads, rasters, labels).
- `lunaris-api` contains **no scientific logic**. Routers translate HTTP into service
  calls; services orchestrate repositories and the libraries.
- The web client never computes science. The only geometry it does is for display
  (placing markers, the camera readout), and it is unit-tested against the same
  conventions as the Python core.
- Planned scientific modules exist only as documented package boundaries
  (`lunaris_science/{terrain,…}/__init__.py` docstrings). A test asserts they expose no
  functions, so nothing can be mistaken for an implemented calculation.

## 2. Contracts between frontend and backend

1. Pydantic schemas in `apps/api/src/lunaris_api/schemas/` define the wire format.
   Response schemas are serialized in "serialization mode", so fields with defaults are
   marked required (they are always present).
2. `uv run lunaris-api-openapi` writes `packages/shared-types/openapi/lunaris-api.openapi.json`.
3. `openapi-typescript` generates `packages/shared-types/src/generated/lunaris-api.ts`.
4. `packages/shared-types/src/api.ts` re-exports friendly aliases (`HealthResponse`,
   `CandidateSite`, …).
5. Drift is impossible to merge: `tests/api/test_openapi_contract.py` fails if the
   committed document differs from the app, and `npm run contracts:check` fails if the
   generated TypeScript differs from the document (both run in CI).

Draft contracts for unimplemented modules (`terrain.ts`, `illumination.ts`,
`visibility.ts`, `mission.ts`, `analysis.ts`) are hand-written and marked
`@status draft`; the API does not serve them yet.

## 3. Backend

- **Factory**: `lunaris_api.app.create_app(settings)` builds an isolated app (tests create
  one per test with a temporary data directory). `lunaris_api.main:app` is the ASGI entry.
- **Configuration**: `pydantic-settings`, prefix `LUNARIS_`, optional `.env`
  (`.env.example` documents every variable). Wildcard CORS origins are rejected.
- **Middleware order** (outermost first): `CORSMiddleware` → `RequestContextMiddleware`
  → routes. The request-context middleware assigns/echoes `X-Request-ID`, logs one access
  line with duration, and converts unexpected exceptions into the error envelope *inside*
  CORS, so even 500s are readable by the browser. Internal details are logged, never
  returned.
- **Errors**: every non-2xx response is `{"error": {code, message, details, request_id}}`
  (`ErrorResponse` in OpenAPI), including validation (422), 404, 409 and 500.
- **Health**: `GET /health` returns 200 when all checks pass and 503 with the same schema
  when degraded (database `SELECT 1`, data directory, manifest registry).
- **Persistence**: SQLAlchemy 2.x behind a `SiteRepository` protocol; services depend on
  the protocol, not on sessions. SQLite (WAL mode) at `data/state/lunaris.sqlite3` for
  development. Moving to PostgreSQL/PostGIS means changing `LUNARIS_DATABASE_URL` and
  adding Alembic migrations before the first schema change that must preserve data.
- **Bounded resources**: the site registry is capped (250) and names are unique
  (case-insensitive), so list responses stay bounded without pagination in M01.

## 4. Data layer

```
data/
  raw/<dataset-id>/         products as distributed + acquisition.json
  kernels/<dataset-id>/     SPICE kernels + acquisition.json
  processed/<dataset-id>/   LUNARIS-derived artefacts (M02+)
  state/                    SQLite development database
  fixtures/                 small committed fixtures and validation references
```

Status is computed from presence and sizes against the acquisition record (cheap enough
for every API request); full SHA-256 verification is an explicit CLI operation. See
`docs/DATA_SOURCES.md`.

## 5. Frontend

- **Next.js 16 App Router** with Cache Components and Partial Prefetching (the framework
  defaults for this version). All routes prerender as static shells; live data is fetched
  in the browser.
- **No time in prerendered HTML.** Wall-clock and analysis-epoch state initialize after
  mount (`UtcClock`, `initializeTime`), as Cache Components forbids `Date.now()` during
  prerender and it would cause hydration mismatches.
- **Data fetching**: a typed client (`lib/api/client.ts`: timeouts, error-envelope
  parsing, request ids, latency, shallow runtime shape checks) wrapped by TanStack Query
  hooks (`lib/api/queries.ts`). Queries report "pending" until hydration completes
  (`useHydrated`), because TanStack Query reads its shared cache during hydration — data
  fetched by an earlier-hydrated component would otherwise mismatch the server HTML.
- **State**: a small Zustand store (`store/mission-store.ts`) for epoch/window/playback,
  selection, camera view requests and layer visibility.
- **UI kit**: shadcn/ui conventions (`components.json`, `components/ui/*`) on Radix
  primitives and Tailwind v4 tokens (`app/globals.css`). Status colours and evidence
  colours are separate vocabularies.
- **Evidence badges**: every displayed value is tagged (OBS / DERIVED / MODEL / CALC /
  ASSUMED / PLACEHOLDER / N/C).

### 5.1 3D viewport

- `components/viewport/moon-viewport.tsx` loads the R3F canvas client-only
  (`next/dynamic`, `ssr: false`) inside an error boundary (no WebGL → message, rest of the
  app keeps working).
- Rendering is **on demand** (`frameloop="demand"`): the scene is static, so frames are
  drawn only on interaction, data changes and camera tweens.
- **Surface**: one shader (`moon-shader.ts`) with two disclosed modes — the acquired NASA
  SVS color map (sampled per fragment from MOON_ME lon/lat, seam-safe gradients, no
  invented relief) or a **procedural placeholder** (synthetic craters and noise evaluated
  in 3D, so no seams or polar pinching; LOD by screen-space footprint). The HUD always
  states which one is showing.
- **Lighting**: view-relative display light, explicitly labeled as *not* the computed Sun.
  Ephemeris-driven lighting arrives with M03–M04.
- **Labels**: one DOM layer positioned imperatively from the render loop
  (`label-registry.ts`), instead of a React root per label.
- **Camera**: presets (south polar, pole with 0° at top, near side, far side), fly-to on
  site selection, rotation speed scaled with altitude, telemetry readout.

## 6. Testing strategy

| Layer | Tooling | Location |
| --- | --- | --- |
| Scientific core | pytest + Hypothesis | `tests/science` |
| Data layer (manifests, acquisition against a loopback server, integrity, CLI, texture builder) | pytest | `tests/data` |
| API (in-process) | pytest + Starlette TestClient (httpx2) | `tests/api` |
| API (real uvicorn process, CORS, persistence) | pytest | `tests/integration` |
| Contract drift | pytest + `contracts:check` | `tests/api`, `packages/shared-types/scripts` |
| Web units (client, geometry, time, store) | Vitest | `apps/web/src/**/*.test.ts` |
| End-to-end (browser ↔ web ↔ API) | Playwright | `tests/integration/e2e` |

Synthetic test data is generated inside tests and labeled synthetic; it is never presented
as lunar data.

## 7. Decision log

| Decision | Rationale |
| --- | --- |
| Modular monolith | One deployable API; scientific modules are libraries, not services. |
| uv workspace + npm workspaces | One lockfile per language (`uv.lock`, `package-lock.json`) for reproducible installs. |
| snake_case wire format with unit suffixes | Identical names in Python and TypeScript; no mapping layer that could drop a unit. |
| OpenAPI-generated TS types | The backend is the single source of truth for implemented contracts. |
| shadcn/ui components written in-repo | The shadcn registry was unreachable from the build environment; components follow the shadcn source conventions and `components.json` is configured for future `shadcn add`. |
| Plotly deferred to the first module that produces time series | Part of the approved stack, but M01 has nothing real to plot; shipping a multi-megabyte charting bundle to draw empty axes would violate "avoid excessive dependencies". |
| No curated landing sites in M01 | Coordinates for Artemis candidate regions could not be cited to a verified source; sites are user-defined and labeled. |
| Procedural placeholder + optional NASA texture | NASA hosts were unreachable when building M01; the placeholder is labeled, and the real texture is one command away. |
| View-relative lighting | A fixed "sun" would imply computed illumination. |
| `httpx2` for tests | Starlette 1.x deprecates `httpx` in its TestClient; runtime code keeps the stable `httpx`. |

## 8. LUNARIS FIELD (future)

FIELD — astronaut visor/camera integration — is a long-term research direction (see
`docs/ROADMAP.md`). **No FIELD code, interfaces or dependencies exist.** The architecture
keeps the option open: FIELD would be a separate application consuming the same
scientific core and data layer, never a modification of MISSION internals.
