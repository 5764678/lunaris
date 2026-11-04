# lunaris-data

Dataset manifests, reproducible acquisition, integrity verification and
preprocessing for the NASA products LUNARIS uses. Large datasets and SPICE kernels
are **never committed**; this package fetches them and records provenance.

```bash
uv run lunaris-data list                      # registry + local status
uv run lunaris-data show lola-ldem-75s-240m   # full manifest
uv run lunaris-data acquire naif-generic-kernels-lunar
uv run lunaris-data verify naif-generic-kernels-lunar
uv run lunaris-data build-web-texture         # after acquiring nasa-svs-cgi-moon-kit
```

| Subpackage | Responsibility |
| --- | --- |
| `manifests/` | One JSON manifest per dataset: source URLs, citation, CRS, resolution, verification status |
| `registry` | Loads and validates manifests |
| `store` | Local data layout (`data/raw`, `data/kernels`, …), acquisition records, status |
| `ingestion/` | Streaming download with SHA-256, atomic writes, acquisition records |
| `validation/` | Integrity re-verification against acquisition records |
| `preprocessing/` | Derived, documented artefacts (M01: web visualization texture) |

Every acquired dataset directory contains `acquisition.json`: source URL, final
URL after redirects, HTTP validators, byte size, SHA-256, retrieval time and tool
version. A file without that record is reported as **untracked** — LUNARIS will not
treat data of unknown provenance as acquired.
