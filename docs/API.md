# LUNARIS — HTTP API (v1)

Base URL in development: `http://localhost:8000`. Interactive documentation:
`/docs` (Swagger UI) and `/redoc`; machine-readable contract: `/openapi.json`
(committed as `packages/shared-types/openapi/lunaris-api.openapi.json`).

## Conventions

| Topic | Rule |
| --- | --- |
| Versioning | Versioned routes live under `/api/v1`. `GET /health` is unversioned and reports `api_version`. Breaking changes require a new prefix. |
| Field names | `snake_case`, units as suffixes: `_deg`, `_m`, `_s`, `_bytes`, `_fraction`; timestamps `_utc`. |
| Timestamps | ISO 8601 UTC with `Z`, e.g. `2026-11-04T10:34:15.791697Z`. |
| Coordinates | Planetocentric latitude [−90, 90]; east longitude stored in [0, 360) (inputs accepted in [−180, 360]); frame `MOON_ME`; heights relative to the 1737.4 km reference sphere. |
| Evidence | Derived values carry an `evidence` object: `kind` (`observation`, `derived_product`, `model`, `calculation`, `assumption`, `placeholder`), `statement`, `sources`, `method`, `assumptions`. |
| Request ids | Send `X-Request-ID` (`[A-Za-z0-9._-]{1,128}`) to correlate logs; otherwise one is generated. It is echoed in the response header and in error bodies. |
| CORS | Origins from `LUNARIS_CORS_ORIGINS` (explicit list; wildcards rejected). Methods `GET, POST, DELETE, OPTIONS`; headers `Content-Type, X-Request-ID`; exposes `X-Request-ID`. No credentials. |
| Errors | Every non-2xx response uses the envelope below. |

### Error envelope

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed.",
    "details": [
      { "location": ["body", "latitude_deg"], "message": "Input should be less than or equal to 90", "type": "less_than_equal" }
    ],
    "request_id": "docs-example-1"
  }
}
```

| Status | `code` |
| --- | --- |
| 404 | `not_found` |
| 405 | `method_not_allowed` |
| 409 | `conflict` |
| 422 | `validation_error` |
| 500 | `internal_error` (no internal details are returned; see server logs by `request_id`) |

## Endpoints

### `GET /health`

Liveness and readiness. **200** when every check passes, **503** with the same body when
degraded.

```json
{
  "status": "ok",
  "service": "lunaris-api",
  "version": "0.1.0",
  "api_version": "v1",
  "environment": "development",
  "time_utc": "2026-11-04T10:34:15.753600Z",
  "uptime_s": 1286.596,
  "checks": [
    { "name": "database", "status": "ok", "detail": null },
    { "name": "data_directory", "status": "ok", "detail": null },
    { "name": "dataset_registry", "status": "ok", "detail": "3 manifests loaded" }
  ]
}
```

### `GET /api/v1/system/runtime`

Versions of the numerical, geospatial and SPICE toolchain serving the API (Python, NumPy,
SciPy, SpiceyPy, CSPICE, rasterio, GDAL, PROJ, httpx, pydantic, LUNARIS packages). Future
analysis results embed this report for reproducibility.

```json
{
  "service_version": "0.1.0",
  "api_version": "v1",
  "environment": "development",
  "components": [
    { "name": "cspice", "version": "CSPICE_N0067", "available": true, "purpose": "NAIF SPICE toolkit (ephemeris geometry)" },
    { "name": "gdal", "version": "3.12.2", "available": true, "purpose": "geospatial raster formats and projections" }
  ]
}
```

### `GET /api/v1/datasets`

All registered datasets: manifest metadata (provider, mission, instrument, frame,
projection, resolution, units, citation, usage, URL verification) joined with local
acquisition status (`missing`, `untracked`, `incomplete`, `acquired`), per-file presence,
size and recorded SHA-256, and the command that acquires the dataset. Status is computed
from presence and sizes; full checksum verification is `uv run lunaris-data verify <id>`.

### `GET /api/v1/datasets/{dataset_id}`

One dataset (same shape as a list item). **404** for unknown ids, **422** for malformed ids.

### `GET /api/v1/sites`

```json
{ "sites": [ /* CandidateSite */ ], "count": 1, "limit": 250 }
```

### `POST /api/v1/sites`

Register a **user-defined** candidate site. LUNARIS ships no curated site coordinates in
Milestone 01; `origin` records that the coordinates came from a user.

Request (`CandidateSiteCreate`; unknown fields are rejected):

```json
{ "name": "Example ridge", "latitude_deg": -89.45, "longitude_deg": -137.31, "reference": null, "notes": null }
```

| Field | Rule |
| --- | --- |
| `name` | 1–80 characters after trimming, no control characters, unique (case-insensitive, whitespace-normalized) |
| `latitude_deg` | finite, −90 … 90 |
| `longitude_deg` | finite, −180 … 360 (stored normalized to [0, 360)) |
| `reference` | optional, ≤ 300 characters — citation for the coordinates |
| `notes` | optional, ≤ 1000 characters |

Response **201** (`CandidateSite`):

```json
{
  "id": "8090474b-bfff-4225-b2c2-6bc5097421d8",
  "name": "Example ridge",
  "coordinate": { "latitude_deg": -89.45, "longitude_deg": 222.69, "frame": "MOON_ME" },
  "origin": "user_defined",
  "reference": null,
  "notes": null,
  "created_at_utc": "2026-11-04T10:34:15.791697Z",
  "body_fixed_position": {
    "x_m": -12258.575596227305,
    "y_m": -11307.927269746007,
    "z_m": -1737319.9527160255,
    "frame": "MOON_ME",
    "reference_radius_m": 1737400.0,
    "evidence": {
      "kind": "calculation",
      "statement": "Body-fixed Cartesian position of the site on the reference sphere.",
      "sources": [{ "source_id": "constant:lola-reference-sphere-radius", "title": "LOLA reference sphere radius (1737.4 km)", "url": null, "version": null, "sha256": null, "citation": "…" }],
      "method": "lunaris_science.coordinates.spherical_to_cartesian (planetocentric → MOON_ME)",
      "assumptions": [
        "Height above the reference sphere not sampled; h = 0 m assumed.",
        "Coordinates are user-defined planetocentric MOON_ME values."
      ]
    }
  }
}
```

**409** on a duplicate name or when the registry limit is reached; **422** on invalid input.

### `GET /api/v1/sites/{site_id}` · `DELETE /api/v1/sites/{site_id}`

Get one site, or delete it (**204**). **404** for unknown ids.

### `GET /api/v1/terrain/scenes` · `GET /api/v1/terrain/scenes/{scene_id}` · `GET /api/v1/terrain/scenes/{scene_id}/data`

Terrain scene export (contract C3 in `docs/TASKS.md`; owner S-TERRAIN). M02 ships one
scene, `south-pole`: a square of the south polar stereographic plane centred on the pole,
±125 km, resampled bilinearly from LOLA `LDEM_75S_240M`.

- `GET /terrain/scenes` lists scenes, with `available` (source DEM acquired locally) and,
  when unavailable, the `acquire_command`.
- `GET /terrain/scenes/{scene_id}?grid_size=512` returns metadata: `width`, `height`,
  `origin_moon_me_m`, `height_reference_radius_m` (1 737 400), `height_min_m`,
  `height_max_m`, `vertex_spacing_m` (map-plane, true at the pole), `half_extent_m`,
  `center_latitude_deg`/`center_longitude_deg`, `resampling`, `method`, `nodata`,
  `nodata_vertex_count`, `layout` (binary description and `byte_length`), `dem`
  (dataset, file, SHA-256 of the file actually read, URL, citation), `evidence`
  (`derived_product`), `etag` and `data_url`.
- `GET /terrain/scenes/{scene_id}/data?grid_size=512` returns `application/octet-stream`:
  little-endian float32, row-major, 4 values per vertex: `x`, `y`, `z` (m, `MOON_ME`,
  relative to `origin_moon_me_m`), then `height_m`. Row 0 is the map's top edge (toward
  0° E); columns advance toward 90° E. Vertices with no DEM value are NaN in all four
  components and must not be drawn.

`grid_size` is the number of vertices per side, 2–1024 (default 512, about 4 MiB; 1024 is
16 MiB). Both scene responses carry a strong `ETag` derived from the DEM SHA-256, the
scene, `grid_size` and the algorithm version, plus `Cache-Control: public, max-age=3600`;
`If-None-Match` returns **304**. **404** for an unknown scene, **422** for an out-of-range
`grid_size`, **503** `dataset_unavailable` when the DEM is not acquired or does not match
the SHA-256 pinned in its manifest. Measured locally with the real DEM: the first metadata
request (reads and hashes the 29 MB DEM, builds the grid) takes ≈ 0.8 s; later requests
are served from the in-process cache.

<<<<<<< HEAD
### `GET /api/v1/sites/{site_id}/terrain`

Terrain analysis at a registered site (T-14; owner S-TERRAIN), computed from a window of
the PGDA LOLA 20 m south-pole DEM read over HTTP byte ranges (`pgda-lola-20mpp-80s`).

Query: `footprint_radius_m` (default 50, max 2000), and the optional hazard thresholds
`max_slope_deg` (0–90) and `max_roughness_m` (> 0). The response holds:
- `height_m`: bilinear, above the 1 737 400 m sphere;
- `scale_factor`: k at the site;
- `slope_at_site`: `slope_deg`, `baseline_m`;
- `footprint`: cell counts including `missing_cell_count`, height range, slope mean / p95 /
  max with `slope_baseline_m`, `roughness_rms_m` with `roughness_baseline_m`;
- `hazard`: `null` unless thresholds are given; otherwise the flags plus `assumption`
  evidence;
- `dem`: window provenance (URL, ETag, Last-Modified, window, bytes requested, retries,
  cache use);
- `evidence`: `calculation`, with method and source;
- `limitations`.

**404** for an unknown site, **422** for invalid input or `out_of_coverage` (outside about
80°S–90°S), **503** `dataset_unavailable` when the window cannot be read. The first
request for a site reads the window remotely (≈ 10–15 s); repeats are served from the
window cache under `data/processed/`.
=======
### `GET /api/v1/sites/{site_id}/ephemeris`

Apparent Sun and Earth geometry from a registered site (contract C2, `docs/SCIENCE.md`
§5.2). Computed locally with NAIF SPICE from the checksum-verified
`naif-generic-kernels-lunar` set (DE440, corrections `CN+S`). JPL Horizons is never called.

| Query | Rule |
| --- | --- |
| `start_utc`, `end_utc` | ISO 8601 with an explicit UTC offset (`Z` or `+00:00`); `end_utc ≥ start_utc` |
| `step_s` | 1 s … 2 592 000 s (30 days) |

Samples are `start_utc + k·step_s` for every k with that epoch ≤ `end_utc`. **Cap: 10 000
samples per request** (one year hourly = 8 760); more gives 422 `sample_cap_exceeded`.

Response **200** (`SiteEphemeris`, abridged):

```json
{
  "site_id": "…", "site_name": "…",
  "observer": { "latitude_deg": -89.5, "longitude_deg": 0.0, "frame": "MOON_ME",
                "reference_radius_m": 1737400.0, "surface_height_m": null,
                "observer_height_m": 0.0, "radius_m": 1737400.0 },
  "start_utc": "2026-11-04T00:00:00Z", "end_utc": "2026-11-05T00:00:00Z", "step_s": 3600.0,
  "sample_count": 25, "max_samples": 10000, "frame": "MOON_ME", "aberration_correction": "CN+S",
  "bodies": [
    { "body": "sun", "body_radius_m": 695700000.0, "body_radii_m": [695700000.0, 695700000.0, 695700000.0],
      "samples": [ { "epoch_utc": "2026-11-04T00:00:00Z", "azimuth_deg": 248.586138,
                     "elevation_deg": 1.304694, "range_m": 148218419000.0,
                     "angular_radius_deg": 0.268933, "direction_moon_me": [-0.364795, -0.930726, -0.025954] } ],
      "evidence": { "kind": "model", "method": "CSPICE spkcpo(… 'CN+S' …) …",
                    "sources": [ { "source_id": "naif-generic-kernels-lunar/de440s.bsp", "sha256": "c1c7…", "…": "…" } ],
                    "assumptions": [ "Surface height not sampled: … (h = 0 m).", "…" ] } },
    { "body": "earth", "…": "…" }
  ],
  "limitations": [ "Elevations are relative to the astronomical horizon …",
                   "Earth geometry is geometric line of sight … does not imply a radio link.", "…" ]
}
```

- `azimuth_deg`: clockwise from local north, [0, 360). `elevation_deg`: above the local
  horizontal plane of the reference sphere (astronomical horizon; terrain is not
  considered here). `direction_moon_me`: apparent unit vector in `MOON_ME`, for scene
  lighting (D5).
- Earth `angular_radius_deg` uses the PCK equatorial radius (6378.1366 km); the evidence
  says so.
- Site heights are not sampled yet, so the observer sits on the 1737.4 km sphere
  (`surface_height_m: null`, stated in each body's evidence).

| Status | `code` / `details[].type` | When |
| --- | --- | --- |
| 404 | `not_found` | Unknown site |
| 422 | `validation_error` / `sample_cap_exceeded` | More than 10 000 samples |
| 422 | `validation_error` / `window_order`, `utc_required` | `end_utc < start_utc`; non-UTC offset |
| 422 | `validation_error` / `outside_kernel_coverage` | Outside 1849-12-26 … 2150-01-21 (DE440s) |
| 422 | `validation_error` / `topocentric_frame_undefined` | Site at latitude exactly ±90° (C0) |
| 422 | `validation_error` | Malformed query (missing field, naive timestamp, `step_s` out of range) |
| 503 | `kernels_unavailable` | Kernels not acquired or failing SHA-256 verification; run `uv run lunaris-data acquire naif-generic-kernels-lunar` |
>>>>>>> origin/main

### `GET /api/v1/sites/{site_id}/horizon`

Terrain horizon mask of a registered site (T-16; owner S-TERRAIN). It is computed with
`compute_horizon_mask` from LOLA `LDEM_75S_240M`: 0.25° step, 200 km range, great-circle
ray march with curvature (docs/SCIENCE.md §5.3).

Query: `observer_height_m` (default 2, max 100; the default is stated as an assumption).
The response carries the C1 fields as lists of 1440 values: `azimuth_deg`,
`elevation_deg` and `truncated`. Also returned: `truncated_count`, `max_range_m`,
`surface_height_m`, `method`, `dem` (dataset, SHA-256, resolution, URL, citation),
`evidence` (`calculation` on a `derived_product` source) and `limitations`. When any ray
leaves coverage before 200 km (sites north of about 82° S), the first limitation states
how many azimuths are truncated (lower bounds).

Masks are computed once and cached as files under
`data/processed/lola-ldem-75s-240m/horizon-masks/`. The cache key covers the DEM SHA-256,
the site coordinates, the observer height, the step, the range and the method version; a
hit never recomputes. Measured with the real DEM: 2.0 s for the first request (including
reading and hashing the DEM), 0.01 s from the cache, about 49 kB of JSON. **404** for an
unknown site, **422** `out_of_coverage` (no LDEM height at the site, about north of 75° S)
or an invalid height, **503** `dataset_unavailable`.

In-process interface for other services (`lunaris_api.services.horizon`):
`HorizonMaskService.get_site_mask(site_id, *, observer_height_m=2.0)` and
`get_mask(*, latitude_deg, longitude_deg, observer_height_m=2.0)`, both returning
`HorizonMask`; the dependency provider is `HorizonMaskServiceDep`.
### `GET /api/v1/catalog/sites` · `POST /api/v1/catalog/sites/{catalog_site_id}/register` · `POST /api/v1/catalog/demo-trio/register`

The cited south-pole candidate-site catalogue (T-03; data from T-02,
`packages/data/src/lunaris_data/catalogs/south-pole-candidate-sites.json`).

- `GET /catalog/sites` returns the 27 PGDA product 78 sites, with `reference_point`
  (planetocentric, MOON_ME), `tile`, `pgda_site_id`, `artemis_iii_2022_region` and
  `demo_trio`. The catalogue-level `reference_point_definition` states what the
  coordinates are: the DEM tile centre, **not a landing point**. Also returned: `method`,
  `sources`, `citation` and `limitations`.
- `POST /catalog/sites/{id}/register` adds that site to the registry and returns
  **201** with a `CandidateSite` whose `origin` is `"published"`. Its `reference` holds the
  citation (including the PGDA tile id); its `notes` hold the catalogue id, the Artemis
  III region and the reference-point definition. **404** for an unknown catalogue id,
  **409** if a site with that name is already registered.
- `POST /catalog/demo-trio/register` adds the three `demo_trio` sites in one action. It
  is idempotent: sites already registered under the same name are returned and listed
  in `already_registered`.

`CandidateSite.origin` is now `"user_defined" | "published"` (wire-contract change).

### `POST /api/v1/analysis/timeline`

Illumination and Earth-visibility timelines for a registered site (contract C4,
`docs/SCIENCE.md` §5.3–5.4).

Request (`TimelineRequest`; unknown fields are rejected):

```json
{ "site_id": "…", "start_utc": "2026-11-04T00:00:00Z", "end_utc": "2026-11-05T00:00:00Z", "step_s": 3600 }
```

Window rules, the 10 000-sample cap and the error codes are those of the ephemeris
endpoint. Validation errors point at the body, for example `["body", "step_s"]`.

Response **200** (`TimelineAnalysis`, abridged):

```json
{
  "site_id": "…", "site_name": "…", "observer": { "…": "…" },
  "start_utc": "2026-11-04T00:00:00Z", "end_utc": "2026-11-05T00:00:00Z", "step_s": 3600.0,
  "sample_count": 25, "max_samples": 10000, "terrain_horizon_available": false,
  "illumination": {
    "body": "sun",
    "samples": [ { "epoch_utc": "…", "azimuth_deg": 248.586138, "elevation_deg": 1.304694,
                   "solar_radius_deg": 0.268933, "astronomical_visible_fraction": 1.0,
                   "terrain_horizon_elevation_deg": null, "terrain_visible_fraction": null,
                   "terrain_truncated": null } ],
    "astronomical": { "horizon": "astronomical", "mean_visible_disk_fraction": 1.0,
                      "illuminated_fraction": 1.0, "fully_lit_fraction": 1.0,
                      "longest_illumination_s": 86400.0, "longest_illumination_censored": true,
                      "longest_darkness_s": 0.0, "longest_darkness_censored": false,
                      "resolution_s": 3600.0, "any_truncated": false,
                      "sunlit_windows": [ { "start_utc": "2026-11-04T00:00:00Z", "end_utc": "2026-11-05T00:00:00Z",
                                            "duration_s": 86400.0, "censored_start": true, "censored_end": true } ] },
    "terrain": null,
    "evidence": { "kind": "calculation", "…": "…" },
    "limitations": [ "…", "Terrain horizon not available for this site: …" ]
  },
  "earth_visibility": {
    "body": "earth",
    "samples": [ { "…": "…", "earth_radius_deg": 0.961446, "line_of_sight": "below_geometric_horizon" } ],
    "astronomical": { "horizon": "astronomical", "visible_fraction": 0.0, "windows": [], "…": "…" },
    "terrain": null,
    "evidence": { "…": "…" },
    "limitations": [ "Geometric line of sight only: Earth visibility does not imply a radio link. …", "…" ]
  },
  "computed_at_utc": "…",
  "software": { "service_version": "0.1.0", "components": [ { "name": "cspice", "version": "CSPICE_N0067" } ] }
}
```

- Each sample carries the astronomical **and** the terrain fraction. Terrain uses the
  site's C1 horizon mask from LDEM_75S_240M (0.25°, 200 km, eye 2 m above the DEM
  surface), and the observer is placed at that height. The terrain fields are `null`
  when no mask can be produced (`terrain_horizon_available: false`, reason in
  `limitations`): DEM not acquired, or site outside 75°–90° S.
- Each sample's interval [t, t + step) is clipped to the requested window, so durations
  and fractions never extend past `end_utc` (the last sample of an end-inclusive grid has
  weight 0).
- `*_censored: true` means the run touches the analysis window edge, so its duration is a
  lower bound. Window edges are known to ± `resolution_s`.
- `terrain_truncated: true` means the mask ray left DEM coverage. There the terrain
  fraction is an upper bound.

### `GET /api/v1/analysis/site-comparison`

The demo comparison table (T-17; owner S-TERRAIN). Query: `site_ids` (comma-separated,
1–10), `start_utc` / `end_utc` (default: calendar year 2027), `step_s` (default 3600),
`observer_height_m` (default 2) and `footprint_radius_m` (default 50). The window obeys
the ephemeris sample cap (10 000); the default gives 8 761 samples.

The response holds one row per site with these cells:
- `surface_height_m` (LDEM_75S_240M);
- `slope_at_site_deg`, `slope_p95_deg` and `roughness_rms_m`, each with `baseline_m`
  (PGDA 20 m, T-14);
- `horizon_min_deg`, `horizon_max_deg` and `horizon_truncated_azimuths` (T-16 mask);
- `sun_mean_visible_disk_fraction`, `sun_illuminated_fraction` and `sun_longest_hidden_s`;
- `earth_visible_fraction` and `earth_longest_outage_s` (T-24, terrain horizon).

Every cell is `{value, unit, baseline_m, reason, evidence, limitations}`. The evidence
names its kind, method and sources (manifest id plus SHA-256, or URL plus ETag), so the
UI can show the source of any number. A cell that cannot be computed has `value: null`
and a `reason` (for example outside PGDA 20 m coverage, or `terrain illumination not
available` while the timeline has no terrain horizon); it is never 0. Illumination cells
state their period in `limitations`, because published values use other periods.
`columns` lists each key with its label, unit and description.

**Summary (T-18, `docs/DECISIONS.md` D9).** Each column also declares `better`
(`"higher"`, `"lower"` or `null`) with a one-line `better_rationale`. Height, horizon
min/max and the truncation count are `null` and are not ranked. `summary` holds:
- `leaders`: per directed column, the site ids with the best non-null value (ties
  allowed; empty when fewer than two sites have a value).
- `sites`: per site, `leads`, `trails`, `directed_compared`, `dominated_by` (Pareto over
  shared non-null directed columns) and a `dominance` sentence.
- `verdict`: generated from dominance only. When there is no clear winner it begins
  "No single site is best on every directed metric."
- `method`.
- `score`: only with `profile=power|comms|landing`, a weighted ordering over fixed
  documented weights and min-max normalisation within the compared sites, returned as
  `assumption` evidence. Without `profile` it is `null`: there is no default score.

The demo trio over 2027 gives: "No single site is best on every directed metric. Peak near
Shackleton leads on slope, sunlight and darkness and Earth visibility; trade-off: worst on
roughness. Malapert massif leads on roughness; trade-off: worst on sunlight and darkness
and Earth visibility. Connecting ridge leads on no metric but is not dominated; worst on
slope."

## Changing the contract

1. Edit the Pydantic schemas in `apps/api/src/lunaris_api/schemas/`.
2. Run `npm run contracts:generate` (regenerates the OpenAPI JSON and the TypeScript types).
3. Commit both generated files. CI fails on drift (`npm run contracts:check`,
   `tests/api/test_openapi_contract.py`).
