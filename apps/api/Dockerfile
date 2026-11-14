# syntax=docker/dockerfile:1.7
# LUNARIS API image. Build context: repository root.
#   docker build -f apps/api/Dockerfile -t lunaris-api .
FROM python:3.12-slim AS runtime

# rasterio/GDAL wheels need the system Expat shared library at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends libexpat1 \
    && rm -rf /var/lib/apt/lists/*

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
    LUNARIS_ENVIRONMENT=production \
    LUNARIS_SEED_CATALOG=true \
    MALLOC_ARENA_MAX=2 \
    MALLOC_MMAP_THRESHOLD_=262144 \
    MALLOC_TRIM_THRESHOLD_=262144
# The three MALLOC_* settings make glibc return freed numpy buffers to the OS instead of keeping
# the high-water mark: a year-long timeline peaks near 100 MiB, and Render's free plan has 512 MiB.

# Optional, for hosts without a persistent disk (e.g. a Render free web service):
#   LUNARIS_BAKE_DATASETS  space-separated manifest ids, acquired and checksum-verified
#                          into /data at build time (docker-compose bind-mounts ./data
#                          instead, so the default is empty);
#   LUNARIS_PREWARM_DEMO   "1" runs the site comparison once per cited site, so horizon masks
#                          and PGDA windows are cached in the image and each site's 2027
#                          timeline is baked to /data/processed/timelines (served from disk).
ARG LUNARIS_BAKE_DATASETS=""
ARG LUNARIS_PREWARM_DEMO=""
COPY apps/api/scripts/prewarm_demo.py /app/prewarm_demo.py
RUN set -e; for d in $LUNARIS_BAKE_DATASETS; do lunaris-data acquire "$d"; lunaris-data verify "$d"; done
RUN if [ "$LUNARIS_PREWARM_DEMO" = "1" ]; then python /app/prewarm_demo.py; fi

EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=3 \
  CMD ["python", "-c", "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2).status == 200 else 1)"]
CMD ["uvicorn", "lunaris_api.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
