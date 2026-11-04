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

## Changing the contract

1. Edit the Pydantic schemas in `apps/api/src/lunaris_api/schemas/`.
2. Run `npm run contracts:generate` (regenerates the OpenAPI JSON and the TypeScript types).
3. Commit both generated files. CI fails on drift (`npm run contracts:check`,
   `tests/api/test_openapi_contract.py`).
