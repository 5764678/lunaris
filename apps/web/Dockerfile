# syntax=docker/dockerfile:1.7
# LUNARIS web image (Next.js standalone server). Build context: repository root.
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_LUNARIS_API_URL=http://localhost:8000 -t lunaris-web .
# NEXT_PUBLIC_* values are inlined into the browser bundle at build time.
# Globe texture (NASA SVS CGI Moon Kit), built by the data package. Set
# LUNARIS_WEB_TEXTURE=0 to skip it; the globe then shows its labelled placeholder.
FROM python:3.12-slim AS texture
RUN apt-get update && apt-get install -y --no-install-recommends libexpat1 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /bin/
ENV UV_PYTHON_DOWNLOADS=never UV_LINK_MODE=copy
WORKDIR /repo
COPY pyproject.toml uv.lock ./
COPY packages/science packages/science
COPY packages/data packages/data
COPY apps/api/pyproject.toml apps/api/README.md apps/api/
RUN uv sync --frozen --no-dev --package lunaris-data
ARG LUNARIS_WEB_TEXTURE=1
RUN mkdir -p /out/moon && if [ "$LUNARIS_WEB_TEXTURE" = "1" ]; then \
      ( uv run --no-sync lunaris-data acquire nasa-svs-cgi-moon-kit \
        && uv run --no-sync lunaris-data build-web-texture --output-dir /out/moon ) \
      || { echo "WARNING: globe texture not built; the labelled placeholder will be used"; rm -rf /out/moon/*; }; \
    fi

FROM node:22-alpine AS build
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared-types/package.json packages/shared-types/
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

COPY packages/shared-types packages/shared-types
COPY apps/web apps/web
COPY --from=texture /out/moon apps/web/public/textures/moon
ARG NEXT_PUBLIC_LUNARIS_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_LUNARIS_API_URL=${NEXT_PUBLIC_LUNARIS_API_URL} \
    NEXT_OUTPUT=standalone
RUN npm run build -w @lunaris/web

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S lunaris && adduser -S -G lunaris lunaris
# Monorepo standalone layout: server at apps/web/server.js, traced node_modules at the root.
COPY --from=build --chown=lunaris:lunaris /repo/apps/web/.next/standalone ./
COPY --from=build --chown=lunaris:lunaris /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=lunaris:lunaris /repo/apps/web/public ./apps/web/public
USER lunaris
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "apps/web/server.js"]
