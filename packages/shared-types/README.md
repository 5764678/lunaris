# @lunaris/shared-types

TypeScript contract types shared by LUNARIS clients.

- `src/generated/lunaris-api.ts` — **generated** from
  `openapi/lunaris-api.openapi.json`, which is itself generated from the FastAPI
  application. Never edit either by hand.
- `src/api.ts` — friendly aliases for the implemented endpoints.
- `src/conventions.ts` — units, naming and coordinate conventions.
- `src/{coordinates,provenance,sites,mission,terrain,illumination,visibility,analysis}.ts`
  — domain types. Anything marked `@status draft` documents a planned contract that the
  API does not serve yet.

```bash
npm run contracts:generate   # after changing Pydantic schemas in apps/api
npm run contracts:check      # CI: fails if either generated file is stale
```
