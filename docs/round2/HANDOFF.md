# LUNARIS Round 2: Handoff for the Rebuild Session

> **Audience:** a fresh Claude Code session linked to a NEW, empty repository.
> **Build date:** 14 November 2026 (hackathon runs 14–15 Nov). **Do not create or populate the new repo before the 14th, and do not postpone it past the 14th.**
> **Written:** 11 Nov 2026, by the planning session.

---

## 0. Read this first

1. Your job is to **build LUNARIS Round 2 from scratch in the new repo you are linked to**.
2. The old LUNARIS is a **prototype used only as a requirements source and as the home of two frozen libraries**. Do not refactor it, do not copy its integration layer.
3. **You must read from the snapshot branch below. You must never write to it.**

### Source of truth

| Item | Value |
|---|---|
| Source repo | `5764678/lunaris` (attach it with `add_repo`, access **read**) |
| **Snapshot branch** | `snapshot/pre-education-pivot-2026-11-11` |
| Frozen code commit | `8edfb32778f4655aeb107fbb9c0140184f31104c` (README v0.9.0, 9 Nov 2026) |
| Branch to avoid | `main` and any `claude/*` branch of the old repo are moving targets (education-pivot work lands there). **Only the snapshot branch is the reference.** |

The snapshot branch carries two docs-only commits on top of `8edfb32` (this handoff and a guard notice). All **code** is identical to `8edfb32`. If the code ever differs from that commit, stop and tell the user.

---

## 1. Decisions already made (do not re-litigate)

- **Science core frozen.** `packages/science` (`lunaris_science`) and `packages/data` (`lunaris_data`) are taken as libraries, unchanged. Their tests are the acceptance gate.
- **No auth.** Explicit non-goal.
- **No educational features.** They belong to a separate project, which is why the snapshot exists. Do not add any.
- **Same stack, rebuilt:** Python/FastAPI, Next.js 16 / React 19 / R3F, TanStack Query, code-first Pydantic → OpenAPI → generated client. **Postgres + Alembic** replaces SQLite.
- **Two days, not three.** Day 1 = 14 Nov, Day 2 = 15 Nov.
- **Carry-forward allowlist** (pure, tested display math; moved, not re-typed): `apps/web/src/components/viewport/moon-shader.ts`, `lib/geo/selenographic.ts`, `lib/globe/sun.ts`, `lib/terrain/sun.ts`, `lib/time/time.ts` (+ their tests). Everything else is rebuilt.

If a decision seems wrong, raise it with the user. Do not silently reverse it.

---

## 2. What the prototype is (verified, 11 Nov)

About 25k lines. A modular monolith:

- `packages/science`: pure scientific core, no I/O. SPICE geometry, horizon masks, illumination, terrain analysis, scoring, `Evidence` model. Validated: Sun/Earth directions match JPL Horizons to 0.002″; horizon masks match an independent implementation to < 0.0001°.
- `packages/data`: manifests, acquisition, integrity (SHA-256), DEM readers, remote HTTP-range windows, CLI.
- `apps/api`: FastAPI. Routers → services → repositories → SQLite. Services: `compare.py` (561 lines), `terrain.py` (457), `ephemeris.py` (356), `illumination.py` (301), `compare_summary.py` (375), `sites.py`, `datasets.py`, `horizon.py`, `catalog.py`.
- `apps/web`: Next.js 16 App Router. Routes: Overview `/`, `/illumination`, `/terrain`, `/compare`, `/data`. Hand-written `lib/api/client.ts` (586 lines) and `queries.ts` (365), one Zustand store `store/mission-store.ts`.
- `packages/shared-types`: OpenAPI-generated TS types plus hand-written "draft" types.
- Docs: `docs/{ARCHITECTURE,API,SCIENCE,DATA_SOURCES,DECISIONS,ROADMAP,TASKS}.md`. **`DECISIONS.md` (D1–D9) and `SCIENCE.md` are the best requirements sources. Read them before designing.**

### Business rules that must survive (from README/docs)
- Evidence on every number: OBS / DERIVED / MODEL / CALC / ASSUMED / PLACEHOLDER / N/C; each opens data source, method, limitations, SHA-256.
- Frame `MOON_ME`; apparent directions with light-time + stellar aberration (CN+S); UTC→ET via leap-seconds kernel; **latitude exactly ±90° rejected explicitly**, never a silent NaN.
- Horizon mask: 1440 azimuths, 200 km, curvature-corrected; truncated azimuths drawn as lower bounds; censored runs shown as "≥".
- Terrain: height, slope at site, footprint slope (p95), roughness from the PGDA 20 m DEM via HTTP range requests; thresholds are labelled user assumptions.
- Compare: up to 10 sites over 2027; per-measure direction, leaders, Pareto dominance, verdict generated from them, **never hidden weights**; profile (power/comms/landing) weights shown as assumptions.
- Site registry: cap 250, case-insensitive unique names, lat ∈ [−90, 90], lon ∈ [0, 360). Catalog = cited south-pole sites (PGDA product 78); caveat "tile centre, not a landing point".
- Error envelope on every non-2xx: `{"error": {code, message, details, request_id}}`; `X-Request-ID` echoed; health returns 503 with the same schema when degraded.
- Known fixtures: Shackleton floor = **0 % sunlit**; demo trio over 2027 → Peak near Shackleton leads on slope/sunlight/Earth visibility but is roughest; Malapert massif smoothest; under the landing profile Malapert is first.

---

## 3. Anti-patterns to design against

Observed in the prototype:
- Process-global mutable caches with `threading.Lock` (`services/terrain.py`, `services/compare.py`, state on `app.state`).
- CPU-bound science running in the request thread pool.
- SQLite app state with no migrations; free-plan restarts lose registered sites.
- Hand-maintained wire client with shallow runtime checks; hand-written draft contracts for unbuilt modules.
- One UI store mixing time, selection, camera, scene transition and layers; `useHydrated` hydration workaround.
- Fat service files mixing orchestration, caching and response shaping.

**Verify before you rely on them** (not confirmed): N+1 queries in repositories, over-fetching in `queries.ts`, re-render storms from playback ticking. Record findings in `docs/round2/findings.md`.

---

## 4. Target architecture

### Database (Postgres 16, SQLAlchemy 2, Alembic)
- `sites(id uuid pk, name, name_key unique, lat_deg, lon_deg, frame, origin, reference, notes, created_at)` with CHECKs for lat/lon, `frame` enum, `origin` enum (`catalog|user`). Catalog seeded by migration `0002` (source: `packages/data/.../catalogs/south-pole-candidate-sites.json`).
- `analysis_artifacts(key pk, kind, input_digest, params jsonb, code_version, payload_ref, created_at, last_hit_at, hits)`: index for the content-addressed cache; payloads in an artifact store (filesystem locally, object storage in prod).
- `dataset_status_snapshots(dataset_id, checked_at, status, bytes, sha256_ok)`.

### State
- TanStack Query owns all server data; one query-key factory encoding every input.
- Zustand slices: `time` (rAF tick in a ref, throttled commit), `viewport`, `layers`. Selected site / scene / compare set / profile live in the **URL**.

### Contracts
- Code-first Pydantic v2 in `contracts/v1/` → OpenAPI → `@hey-api/openapi-ts` (types + client + Zod) → `packages/contracts`.
- `/v1` prefix; units in field names; ISO-8601 UTC; snake_case; shared error envelope; `evidence` on every number; cursor pagination; `Idempotency-Key` on site creation.
- CI drift gate (`contracts:check`) plus golden-master tests through ASGI.
- No hand-written contracts for unbuilt modules.

### Performance (in the foundation)
1. Content-addressed cache: key = `sha256(kind | science_version | dataset sha256s | canonical params)`.
2. Single-flight on identical concurrent requests.
3. `ProcessPoolExecutor` for science; event loop never blocks. No task queue unless a request routinely exceeds ~10 s after caching (D1).
4. Kernels/DEM handles load in the FastAPI lifespan; demo trio's horizon masks prewarmed.
5. `ETag` + `Cache-Control: immutable` on content-addressed responses.
6. Compare = parallel per-site rows (row is the cache unit); summary is a pure function over rows.
7. R3F canvas and Plotly are dynamic imports; timeline series downsampled server-side.
8. CI budgets: initial JS ≤ 200 kB gz on non-viewport routes; cached analysis API p95 < 150 ms; cold horizon mask measured and recorded.
9. *(Cut first)* Binary terrain scene payload, adopted only if ≥ 5× smaller.

### Dependency rules (enforced by import-linter and ESLint boundaries)
`modules/*` → `contracts`, `infra`, `core`, `science`, `data`; `infra` never imports `modules`; modules never import each other; `science` imports no I/O/web libs; web `features/*` import `shared` and `viewport`, never each other.

### Folder structure

```
<new-repo>/
├─ docs/  ARCHITECTURE.md API.md SCIENCE.md DATA_SOURCES.md DECISIONS.md(append D10+)
│         round2/  disposition.md  findings.md  budgets.md
├─ packages/
│  ├─ science/      # FROZEN, from snapshot
│  ├─ data/         # FROZEN, from snapshot
│  └─ contracts/    # GENERATED: openapi/ + src/{types,client,zod}.ts
├─ apps/
│  ├─ api/
│  │  ├─ alembic.ini  migrations/versions/{0001_schema,0002_seed_catalog}.py
│  │  └─ src/lunaris_api/
│  │     ├─ main.py app.py
│  │     ├─ core/        settings logging errors request_context lifespan deps
│  │     ├─ contracts/v1/ common sites ephemeris horizon illumination terrain compare datasets health
│  │     ├─ modules/     sites ephemeris horizon illumination terrain compare(rows,summary,service,router) datasets system
│  │     └─ infra/       db/{engine,models,session}  cache/{keys,artifact_store,single_flight,metrics}  compute/{process_pool,science_adapter}
│  └─ web/src/
│     ├─ app/            thin routes: overview illumination terrain compare data
│     ├─ features/       sites time overview illumination terrain compare data  (each: api/ model/ ui/)
│     ├─ viewport/       R3F scene (shader CARRIED)
│     └─ shared/         api/{client,keys,errors}  state/{time,viewport,layers,url}  ui/  lib/{geo,time,config}
├─ tests/  science/(copied, untouched)  golden/  api/  e2e/
├─ docker-compose.yml   # api, web, postgres
└─ .github/workflows/ci.yml
```

---

## 5. Two-day schedule

**Cut order if behind:** (1) binary terrain payload, (2) HTTP caching, (3) compare polish/Pareto UI. **Never cut:** globe, Illumination, Terrain.

### Day 1: 14 Nov (foundations + backend through illumination)
| # | Task | Exit check |
|---|---|---|
| 1.1 | Create repo skeleton; copy `packages/{science,data}` and `tests/science` from the snapshot **at commit `8edfb32`** | `uv run pytest tests/science` green, unchanged |
| 1.2 | Golden-master capture: **run the prototype from the snapshot checkout** against demo trio + edge sites (pole ±90°, outside DEM coverage, censored windows); save request/response pairs to `tests/golden/` | Golden files committed with a replay script |
| 1.3 | `core/` (settings, logging, request context, error envelope, lifespan) | Envelope + request-id tests |
| 1.4 | Postgres, Alembic `0001`/`0002`, sites repo with DB constraints | Up/down + constraint-violation tests |
| 1.5 | `contracts/v1` schemas, OpenAPI export, generated client/Zod | `contracts:check` green |
| 1.6 | CI: ruff, mypy, import-linter, pytest, contracts, vitest | Green pipeline |
| 1.7 | `infra/cache` + `infra/compute` (single-flight, artifact store, process pool) | N identical requests → 1 compute |
| 1.8 | Slices: sites, datasets, system, ephemeris, horizon, illumination | Golden numbers match prototype |

### Day 2: 15 Nov (terrain, compare, frontend, ship)
| # | Task | Exit check |
|---|---|---|
| 2.1 | Slices: terrain, compare (rows + pure summary; port `compare_summary` tests) | Golden verdict identical |
| 2.2 | `shared/` (generated client wrapper, keys, errors, URL state, UI kit) + shell | Renders against real API |
| 2.3 | Features: sites + time + timeline; overview (CARRY shader, globe/terrain) | Playwright screenshot |
| 2.4 | Features: illumination, terrain, compare, data | Golden values on screen per route |
| 2.5 | Budgets, e2e, Docker/Render config, README + ADR D10 | `check` green; budgets measured |

### Final verification
1. `tests/science` passes unchanged.
2. `tests/golden` replay equals prototype output (numbers, evidence, errors).
3. `contracts:check` shows no drift.
4. Concurrency test (N → 1 compute); repeat request returns 304 when caching is in scope.
5. Playwright: Shackleton floor 0 % sunlit; compare verdict as in §2.
6. `docs/round2/budgets.md` holds measured numbers.
7. Restart the API container: catalog sites persist, demo trio warm.

---

## 6. Rules of engagement

- **Do not write to `5764678/lunaris` at all.** Read only. Never push to or open PRs against the snapshot branch, `main`, or any branch there.
- Build date discipline: if you are somehow running before 14 Nov, stop and tell the user.
- Flag before any public deploy: with no auth the site registry is publicly writable; only the 250-site cap and proxy rate limiting protect it.
- Anything outside this handoff (new features, educational content, stack changes) → ask the user first.
- 3 days of work has been compressed into 2; say plainly when you are cutting scope, and what you cut.

## 7. Start-up checklist for the first 15 minutes
1. Confirm today is 14 Nov 2026 and the linked repo is empty/new.
2. `add_repo` `5764678/lunaris` (read); check out `snapshot/pre-education-pivot-2026-11-11` into a separate directory (not inside the new repo's working tree).
3. Verify `git diff 8edfb32 -- packages apps tests` is empty on that checkout.
4. Read `docs/DECISIONS.md`, `docs/SCIENCE.md`, `docs/API.md` there.
5. Tag every prototype file in `docs/round2/disposition.md` as FROZEN / CARRY / REBUILD / DROP.
6. Start Day 1.
