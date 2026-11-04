# data/ — local scientific data store

This directory is the default `LUNARIS_DATA_DIR`. **Nothing acquired here is committed.**
Datasets are fetched reproducibly with `uv run lunaris-data acquire <dataset-id>`, and every
acquired dataset gets an `acquisition.json` provenance record (URL, size, SHA-256, retrieval
time, tool version).

| Directory | Contents | Committed? |
| --- | --- | --- |
| `raw/<dataset-id>/` | Source products exactly as distributed (e.g. LOLA GDR `.LBL` + `.IMG`) | no |
| `processed/<dataset-id>/` | LUNARIS-derived artefacts (Milestone 02+), each with its own provenance | no |
| `kernels/<dataset-id>/` | NAIF SPICE kernels | no |
| `state/` | Application state: the SQLite development database | no |
| `fixtures/` | Small, documented test fixtures and validation references | **yes** |

See `docs/DATA_SOURCES.md` for every dataset, its source, citation and verification status.
