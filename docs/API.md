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

- Each sample carries the astronomical **and** the terrain fraction. The terrain fields are
  `null` when no horizon mask exists for the site (`terrain_horizon_available: false`;
  masks arrive with S-TERRAIN T-15).
- Each sample's interval [t, t + step) is clipped to the requested window, so durations
  and fractions never extend past `end_utc` (the last sample of an end-inclusive grid has
  weight 0).
- `*_censored: true` means the run touches the analysis window edge, so its duration is a
  lower bound. Window edges are known to ± `resolution_s`.
- `terrain_truncated: true` means the mask ray left DEM coverage. There the terrain
  fraction is an upper bound.

## Changing the contract

1. Edit the Pydantic schemas in `apps/api/src/lunaris_api/schemas/`.
2. Run `npm run contracts:generate` (regenerates the OpenAPI JSON and the TypeScript types).
3. Commit both generated files. CI fails on drift (`npm run contracts:check`,
   `tests/api/test_openapi_contract.py`).
