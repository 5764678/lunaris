# LUNARIS — Tasks and interface contracts

Owner: the technical-director (TD) session. This file assigns work for the next phase
(roadmap milestones M02, M03 and M04 — see `docs/ROADMAP.md`) to parallel implementation
sessions, and fixes the interfaces between them so they can work without waiting on each
other. Accepted decisions referenced here are in `docs/DECISIONS.md`.

Implementation sessions update only the **Status** column of their own tasks. Changes to
a contract (section 2) go through the TD: propose them in the PR description and do not
merge a contract change on your own.

---

## 1. Working rules for every session

1. **Branch and PR.** Work on your own branch, cut from the latest `main`. One task (or a
   tightly coupled pair) per PR. Open it as a draft early and keep it small enough to
   review.
2. **Ownership.** Edit only the paths your session owns (section 3). Shared files have
   explicit rules:
   - `apps/api/src/lunaris_api/routers/__init__.py`: add your `include_router` line only.
   - `apps/api/src/lunaris_api/dependencies.py`: append only.
   - Generated contract files (`packages/shared-types/openapi/*.json`,
     `packages/shared-types/src/generated/*`) are **never hand-merged**. On a conflict,
     take `main`'s version and run `npm run contracts:generate`.
   - Docs: edit only your module's sections of `docs/SCIENCE.md`, `docs/API.md` and
     `docs/DATA_SOURCES.md`. Milestone status lines in `docs/ROADMAP.md` are the TD's.
3. **Done means verified.** `npm run check` passes locally and CI is green on the PR head.
   The PR body lists each acceptance criterion with the evidence (test name, command
   output, measured number). The TD re-runs the checks before merge; a completion report
   alone is not evidence (D7).
4. **Science rules.** Every reported value carries its evidence kind, method, units and
   source. No placeholder or synthetic value reaches the UI without a visible label.
   Missing DEM coverage is never treated as zero elevation.
5. **Budget.** Run at high reasoning effort, not max. Don't download products you don't
   need; never commit datasets or kernels.

---

## 2. Interface contracts

### C0 — Shared geometric conventions

- **Frame:** all body-fixed positions and directions are in `MOON_ME` (resolves to
  `MOON_ME_DE440_ME421`; checked by the TD on 2026-11-04 with the acquired kernels).
- **Local horizontal plane:** the plane normal to the **reference-sphere radial
  direction** at the site (sphere radius 1 737 400 m, the PCK and LOLA reference). Both
  SPICE azimuth/elevation (C2) and terrain horizon masks (C1) are measured against this
  same plane. Never against the terrain surface normal.
- **Azimuth:** degrees, clockwise from local north, in [0, 360). This matches JPL
  Horizons and `azlcpo(..., azccw=False, ...)`.
- **Elevation:** degrees above the local horizontal plane, positive up.
- **Pole:** topocentric functions raise `CoordinateError` for latitude exactly ±90°,
  where north and east are undefined (D2). Any latitude strictly inside (−90, 90) is valid.
- **Time:** the API takes and returns ISO 8601 UTC. Internally, ET (TDB) via the
  leap-seconds kernel.
- **Units:** metres, degrees, seconds. Field names carry unit suffixes (`_m`, `_deg`,
  `_s`), per `docs/API.md`.

### C1 — Horizon mask (science core)

Produced by S-TERRAIN, consumed by S-GEOMETRY. The type lives in
`packages/science/src/lunaris_science/horizon_mask.py` (owned by S-TERRAIN, delivered in
its **first** PR as task T-10).

```python
@dataclass(frozen=True, slots=True)
class HorizonMask:
    site: SelenographicCoordinate  # MOON_ME, planetocentric
    observer_height_m: float  # height of the eye point above the DEM surface at the site
    surface_height_m: float  # DEM height at the site above the 1 737 400 m sphere
    azimuth_deg: NDArray[np.float64]  # shape (N,), uniform step, starts at 0.0, C0 convention
    elevation_deg: NDArray[np.float64]  # shape (N,), horizon elevation angle, C0 plane
    # truncated: shape (N,); True where the ray left DEM coverage before max_range_m,
    # in which case elevation_deg there is only a lower bound.
    truncated: NDArray[np.bool_]
    max_range_m: float
    dem_source_id: str  # dataset manifest id
    dem_sha256: str  # checksum of the DEM file the mask came from
    dem_resolution_m: float
    method: str  # e.g. "ray-march, curvature-corrected, ..."
```

- Validation in `__post_init__`: equal lengths, uniform step, finite values, N ≥ 360,
  and the samples cover the full circle exactly (N × step = 360°), so periodic
  interpolation is always defined.
- Consumers interpolate `elevation_deg` linearly and periodically in azimuth.
- A truncated azimuth must be surfaced in any downstream result
  (`limitations`, evidence assumptions). It is never silently used as exact.

### C2 — Body geometry time series (science core + API)

Produced by S-GEOMETRY. One sample per epoch, for the Sun and the Earth:

| Field | Meaning |
|---|---|
| `epoch_utc` | ISO 8601 UTC |
| `azimuth_deg`, `elevation_deg` | apparent topocentric direction (C0), corrections `CN+S` |
| `range_m` | observer–body distance |
| `angular_radius_deg` | `asin(R_body / range)`; `R_body` read from the loaded PCK with `bodvrd`. For the Earth, state in the evidence which radius is used (pck00011 gives 6378.1366 / 6356.7519 km) |
| `direction_moon_me` | apparent unit direction `[x, y, z]` in `MOON_ME`. The 3D scene lights terrain with this vector (D5) |

- Observer: the site at `R = 1 737 400 m + surface_height_m + observer_height_m` when a
  height is known. Otherwise h = 0, stated as an assumption.
- Endpoint: `GET /api/v1/sites/{site_id}/ephemeris?start_utc=&end_utc=&step_s=`, with
  a documented cap on samples per request.
- **CSPICE is not thread-safe**, and FastAPI runs sync endpoints in a thread pool. All
  SPICE calls go through one process-wide lock.

### C3 — Terrain scene export (API)

Produced by S-TERRAIN, consumed by S-WEB. Projection math stays in Python only: the API
returns vertex positions already in `MOON_ME`, so the web never re-implements the polar
stereographic inverse.

- `GET /api/v1/terrain/scenes` lists available scenes. M02 ships one: `south-pole`,
  centred on the pole, about ±125 km, from LDEM_75S_240M.
- `GET /api/v1/terrain/scenes/{scene_id}` returns JSON metadata:
  - `width`, `height` (vertex grid; cap 1024 × 1024)
  - `origin_moon_me_m` `[x, y, z]`: positions in the binary are relative to this point
  - `height_reference_radius_m` (1 737 400)
  - `height_min_m`, `height_max_m`
  - `vertex_spacing_m` (nominal), `resampling` (method)
  - `nodata` (rule: vertices with no DEM value are NaN and must not be drawn)
  - `dem` (dataset provenance with SHA-256), `evidence` (kind `derived_product`)
  - `data_url`
- `GET /api/v1/terrain/scenes/{scene_id}/data` returns `application/octet-stream`:
  little-endian float32, row-major, 4 values per vertex: `x, y, z` (m, relative to
  `origin_moon_me_m`), then `height_m` (for colouring).
- The response must be cacheable (`ETag` derived from DEM checksum + parameters).

Accepted with T-12 (#8):
- Both endpoints take `grid_size` (vertices per side, 2–1024, default 512). It is part of
  the `ETag`, and a matching `If-None-Match` returns `304`.
- Grid orientation: row 0 lies toward 0° E, rows advance toward 180° E, and columns
  advance toward 90° E. The web uses the `MOON_ME` positions and does not infer
  orientation from the index.
- The metadata may carry additional fields beyond the list above. Consumers ignore
  fields they don't use.

### C4 — Illumination and visibility results

`packages/shared-types/src/illumination.ts` and `visibility.ts` hold the draft wire
contracts. S-GEOMETRY finalises them with these changes:

- `IlluminationResult.summary` gains `mean_visible_disk_fraction`: the time average of
  the disk fraction, which is the quantity comparable to published polar illumination
  studies. Keep `illuminated_fraction` (share of samples with any disk visible) and
  define both precisely in `docs/SCIENCE.md`.
- Results report the **astronomical** horizon (body above the C0 plane) and the
  **terrain** horizon (C1 mask) separately.
- Earth results state that geometric line of sight does not imply a radio link.

Accepted with T-24 (#14):
- Each sample carries `astronomical_visible_fraction` and `terrain_visible_fraction`.
  The terrain fraction is null when no mask is available, and the result then says
  `terrain_horizon_available: false`. Samples also carry
  `terrain_horizon_elevation_deg` and `terrain_truncated`.
- Each result carries an `astronomical` summary and a `terrain` summary.
  - Sun: `illuminated_fraction`, `mean_visible_disk_fraction`, `fully_lit_fraction`.
  - Earth: `visible_fraction`, `longest_outage_s`, `fully_visible_fraction`.
  - Longest runs and windows that touch the analysis-window edge are flagged
    `*_censored`.
- Earth line-of-sight state per sample:
  - `clear`: f > 0 against the terrain horizon. This can happen below 0° when the site
    is on a peak.
  - `terrain_obstructed`: visible above the astronomical horizon only.
  - `below_geometric_horizon`: visible above neither.
  Each state is reported together with its fractions. The radio-link disclaimer is the
  first limitation on every Earth result.
- Provenance goes in `evidence.sources`. Each entry gives the dataset manifest id, the
  source URL and the SHA-256, plus `software` versions. This replaces the draft's
  `ephemeris`/`dem` `DatasetProvenance` fields.

---

## 3. Sessions and ownership

| Session | Scope | Owns |
|---|---|---|
| **S-TERRAIN** | M02 terrain intelligence + horizon masks | `packages/science/src/lunaris_science/terrain/**`, `.../horizon_mask.py`, new `packages/data` modules for PDS3 labels, DEM readers and remote windowed sources (plus the manifest-model extension), `apps/api/.../{routers,services,schemas}/terrain.py`, matching `tests/**` |
| **S-GEOMETRY** | M03 celestial geometry + M04 disk fractions and timelines | `packages/science/src/lunaris_science/{geometry,illumination,visibility}/**`, `data/fixtures/validation/horizons-*`, `apps/api/.../{routers,services,schemas}/{ephemeris,illumination,visibility}.py`, matching `tests/**`, `packages/shared-types/src/{illumination,visibility}.ts` |
| **S-WEB** | Real globe texture, south-pole terrain scene, Plotly timeline lanes, SPICE lighting | `apps/web/**`, `tests/integration/e2e/**` |
| **TD** | Reviews and merges, contracts, cited site list | `docs/DECISIONS.md`, `docs/TASKS.md`, `docs/ROADMAP.md` status |

M02 (terrain) and M03 (geometry) run **in parallel**. The roadmap lists them in order,
but neither depends on the other until M04 joins them through C1.

---

## 4. Tasks

Status: `todo`, `in progress`, `in review` (PR open), `done` (merged by the TD).

### TD

| ID | Task | Acceptance | Depends | Status |
|---|---|---|---|---|
| T-01 | Review and merge Milestone 01 (PR #2) | TD re-ran `npm run check` (117 pytest, 42 Vitest, strict mypy/tsc), `next build`, live API + web smoke, real NAIF acquisition + verify; CI green | — | done |
| T-02 | Cited candidate-site list: PGDA product 78's 27 named 5 m sites and NASA's Artemis III candidate regions, each with coordinates and a citation | Every site has a source a reader can check; nothing uncited ships. Delivered as `packages/data/src/lunaris_data/catalogs/south-pole-candidate-sites.json` (27 sites; all 13 Artemis III 2022 regions matched; reference point = DEM tile centre, cross-checked with PROJ) | — | in review |
| T-03 | Serve the site catalogue: `GET /api/v1/catalog/sites`, and let a catalogue site be added to the registry with `origin: "published"` plus its citation (wire-contract change to `CandidateSite.origin`) | Contract generated; catalogue sites show their source and the "tile centre, not a landing point" definition in the UI; the demo trio (`demo_trio: true`) can be added in one action | T-02 | todo; TD assigns to the first free session |

### S-TERRAIN

| ID | Task | Acceptance | Depends | Status |
|---|---|---|---|---|
| T-10 | `HorizonMask` type (C1) + south polar stereographic forward/inverse on the sphere + point scale factor | Round trip < 1e-9° over the 75–90°S domain; k = 2/(1 + sin\|φ\|) with k(75°S) ≈ 1.0173; consistency with the LDEM_75S_240M label grid (offsets 1905.5 px, 240 m/px); **merged first, small PR** | M01 | in review |
| T-11 | PDS3 label parser + LDEM_75S_240M reader | Label values reproduced (3812², HEIGHT = DN × 0.5 m, DN range −15529…14049); heights in metres, NaN nodata; refuses a product whose projection or frame doesn't match | T-10 | in review |
| T-12 | Terrain scene export (C3), `south-pole` scene | Endpoint + contract generated; byte layout tested; vertex positions spot-checked against `spherical_to_cartesian` at 5 vertices; ETag; size cap | T-11 | in review |
| T-13 | Remote windowed source + PGDA 20 m `/vsicurl/` reader | 1000 × 1000 window around a test site read without full download (bytes transferred logged, well under 100 MB); provenance per read (URL, validators, window bounds); documented fallback | T-11 | in review |
| T-14 | Terrain analysis + `GET /api/v1/sites/{id}/terrain` | Height (bilinear), Horn slope with scale-corrected spacing, defined roughness, footprint stats, hazard thresholds as config; every slope/roughness value carries `baseline_m`; synthetic plane/cone slopes within 0.1°; cross-check against `gdaldem slope` on a real window | T-11, T-13 | todo |
| T-15 | Horizon mask computation (C1) from LDEM_75S_240M | Curvature-corrected ray march, scale-corrected distance, truncation flags. Tests: zero-height DEM on the sphere gives horizon = −acos(R/(R+h_obs)) within 0.01°; an axisymmetric synthetic crater rim gives its analytical angle; a site at 78°S flags truncation toward the north. One mask at 0.25° step, 200 km range in < 30 s | T-10, T-11 | todo |

### S-GEOMETRY

| ID | Task | Acceptance | Depends | Status |
|---|---|---|---|---|
| T-20 | SPICE kernel context | Loads only the checksum-verified kernel set from the data store by manifest (explicit paths, no implicit I/O in the science core); process-wide lock; committed test that `MOON_ME` → `MOON_ME_DE440_ME421` | M01 | done |
| T-21 | Body geometry time series (C2) for the Sun and the Earth | Pole rejection (C0); vectorised; 8 760 samples < 2 s. Replace the two-sample fixture with full 25-sample hourly Horizons fixtures for **Sun and Earth** (site −89.5°, 0° E, h = 0, 2026-11-04 00:00 → 11-05 00:00, `QUANTITIES='4'`, `EXTRA_PREC='YES'`), recording the exact request URL and the verbatim `$$SOE…$$EOE` block. Tolerance stated and justified in `docs/SCIENCE.md` (the TD measured ≤ 0.002″ against both `azlcpo` and a manual ENU computation on 2026-11-04). Fix the fixture's stale claim that NASA hosts are blocked | T-20 | done |
| T-22 | `GET /api/v1/sites/{id}/ephemeris` | Contract generated; sample cap enforced with a clear 422; evidence names kernels and corrections | T-21 | in review |
| T-23 | Visible disk fraction against a `HorizonMask` | Synthetic masks: flat 0° horizon with the disk centre on it gives 0.5; centre at +r gives 1; at −r gives 0; intermediate positions match the analytical circular-segment area to 1e-3; step-function horizons tested | T-10 (type only) | done |
| T-24 | Illumination and Earth visibility timelines (C4) + `POST /api/v1/analysis/timeline` | Astronomical vs terrain horizon reported separately; summaries (mean visible disk fraction, illuminated fraction, longest darkness/illumination, visibility windows); truncation surfaced; radio-link disclaimer on Earth results | T-21, T-23, T-15 | todo |
| T-25 | Validation against published polar illumination studies (Mazarico et al. 2011; Gläser et al. 2014) | Reproduce reported values at named locations where possible; differences reported with their causes (DEM, period, method) | T-24 | todo |

### S-WEB

| ID | Task | Acceptance | Depends | Status |
|---|---|---|---|---|
| T-30 | Real globe texture | Dev setup acquires the SVS CGI Moon Kit and runs `build-web-texture`; globe shows it with its provenance; placeholder label only when absent | M01 | in review |
| T-31 | South-pole terrain scene (D5) from C3 | Globe → pole transition; mesh from the binary (NaN vertices skipped); site markers on the terrain; works at 390 px width; frame time measured on the CI browser | T-12 | todo |
| T-32 | Plotly (dynamic import) + Sun/Earth elevation timeline lanes from C2 | Lanes show computed data with evidence badges; the "not computed" state remains for lanes without data; Vitest + e2e | T-22 | todo |
| T-33 | SPICE-driven lighting of the terrain scene | Directional light from `direction_moon_me` at the selected epoch; rendered shadows labelled illustrative; the selected site shows its computed value from T-24 when available (D5) | T-31, T-22 | todo |
