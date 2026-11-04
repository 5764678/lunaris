# @lunaris/web

LUNARIS MISSION web client — Next.js 16 (App Router, Cache Components), React 19,
Tailwind CSS v4, shadcn/ui conventions, React Three Fiber.

```bash
# from the repository root
npm run dev:web        # http://localhost:3000 (expects the API on :8000)
npm run test:web       # Vitest unit tests
npm run test:e2e       # Playwright (starts its own API :8100 and web :3100)
npm run setup:texture -w @lunaris/web   # acquire + build the globe texture (add -- --force to rebuild)
```

### Globe texture

`npm run dev` (and `npm run dev:web`) first runs `scripts/setup-texture.mjs`. If
`public/textures/moon/manifest.json` is missing or invalid, it runs
`uv run lunaris-data acquire nasa-svs-cgi-moon-kit` (checksum-pinned, ~13 MB from
svs.gsfc.nasa.gov; a no-op when already acquired) and `uv run lunaris-data build-web-texture`.
The globe then shows the NASA SVS CGI Moon Kit colour map; clicking the surface line in
the viewport HUD opens its provenance (dataset, source URL, SHA-256, retrieval time,
credit, projection assumption). If acquisition fails, the dev server still starts and the
globe shows the labelled procedural placeholder. The step is skipped when `CI` is set or
`LUNARIS_SKIP_TEXTURE_SETUP=1`.

| Path | Contents |
| --- | --- |
| `src/app/` | Routes: `/` mission overview, `/data` data sources |
| `src/components/shell/` | Top bar, navigation, API/data status, UTC clock |
| `src/components/mission/` | Mission panel: selected site, site registry, readiness, data sources |
| `src/components/timeline/` | Analysis epoch, playback, lanes |
| `src/components/viewport/` | 3D globe: surface shader, graticule, markers, labels, camera |
| `src/components/ui/` | shadcn/ui-style primitives (Radix + Tailwind) |
| `src/lib/api/` | Typed API client and TanStack Query hooks |
| `src/lib/geo/`, `src/lib/time/` | Display geometry and UTC time utilities (unit-tested) |
| `src/store/` | Zustand workspace store |

`NEXT_PUBLIC_LUNARIS_API_URL` (default `http://localhost:8000`) is inlined at build time.
See `../../docs/ARCHITECTURE.md` § Frontend for design decisions.
