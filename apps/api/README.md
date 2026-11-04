# lunaris-api

FastAPI application for LUNARIS. It is a **thin transport layer**: request/response
validation, persistence and HTTP concerns live here; scientific computation lives in
`lunaris-science` and data access in `lunaris-data`. Route handlers never contain
scientific logic.

```bash
# from the repository root
uv run uvicorn lunaris_api.main:app --reload --port 8000
# → http://localhost:8000/health   http://localhost:8000/docs
```

Layout: `settings.py` (env config) · `app.py` (factory) · `routers/` (HTTP) ·
`schemas/` (wire contracts) · `services/` (use-cases) · `db/` (SQLAlchemy models and
repositories) · `errors.py` (error envelope) · `middleware.py` (request context).

See `docs/API.md` for the endpoint reference and conventions.
