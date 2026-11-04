# @lunaris/web

LUNARIS MISSION web client — Next.js 16 (App Router, Cache Components), React 19,
Tailwind CSS v4, shadcn/ui conventions, React Three Fiber.

```bash
# from the repository root
npm run dev:web        # http://localhost:3000 (expects the API on :8000)
npm run test:web       # Vitest unit tests
npm run test:e2e       # Playwright (starts its own API :8100 and web :3100)
```

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
