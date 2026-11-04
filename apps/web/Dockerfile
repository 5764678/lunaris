# syntax=docker/dockerfile:1.7
# LUNARIS web image (Next.js standalone server). Build context: repository root.
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_LUNARIS_API_URL=http://localhost:8000 -t lunaris-web .
# NEXT_PUBLIC_* values are inlined into the browser bundle at build time.
FROM node:22-alpine AS build
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared-types/package.json packages/shared-types/
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

COPY packages/shared-types packages/shared-types
COPY apps/web apps/web
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
