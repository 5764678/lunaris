# syntax=docker/dockerfile:1.7
# LUNARIS API image. Build context: repository root.
#   docker build -f apps/api/Dockerfile -t lunaris-api .
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /uvx /bin/

WORKDIR /app

# 1. Third-party dependencies only (cached until uv.lock or a pyproject changes).
COPY pyproject.toml uv.lock ./
COPY packages/science/pyproject.toml packages/science/README.md packages/science/
COPY packages/data/pyproject.toml packages/data/README.md packages/data/
COPY apps/api/pyproject.toml apps/api/README.md apps/api/
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --package lunaris-api --no-install-workspace

# 2. LUNARIS sources (workspace members).
COPY packages/science/src packages/science/src
COPY packages/data/src packages/data/src
COPY apps/api/src apps/api/src
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --package lunaris-api --no-editable

# Non-root by default; docker-compose overrides the uid to match bind-mounted ./data.
RUN useradd --create-home --uid 10001 lunaris && mkdir -p /data && chown lunaris /data
USER lunaris

ENV PATH="/app/.venv/bin:${PATH}" \
    LUNARIS_DATA_DIR=/data \
    LUNARIS_ENVIRONMENT=production

EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=3 \
  CMD ["python", "-c", "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2).status == 200 else 1)"]
CMD ["uvicorn", "lunaris_api.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
