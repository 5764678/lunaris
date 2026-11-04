# LUNARIS — Roadmap

LUNARIS has two branches: **MISSION** (current development) and **FIELD** (a future
research direction, not implemented). Milestones are delivered in order; each module
ships only with its validation.

| Milestone | Theme | Status |
| --- | --- | --- |
| M01 | Foundation | **Complete** |
| M02 | Terrain intelligence (LOLA ingestion, elevation, slope, roughness) | Next |
| M03 | Celestial geometry (SPICE: Sun/Earth azimuth/elevation, time series) | Planned |
| M04 | Illumination and Earth visibility (terrain horizons, DTE windows) | Planned |
| M05 | Mission intelligence (constraints, scoring, comparison, reports) | Planned |
| M06 | Hardening and presentation (Space Apps demo) | Planned |
| — | Solar energy estimation | Future extension |
| — | LUNARIS FIELD | Future research track |

## M01 — Foundation (complete)

- Monorepo: uv workspace (Python) + npm workspaces (TypeScript), lockfiles, CI.
- `lunaris-science`: constants with citations, `MOON_ME`/`MOON_PA` frames, validated
  coordinate primitives, evidence/provenance model, toolchain report; documented
  boundaries for planned modules.
- `lunaris-data`: dataset manifests (LOLA GDR 240 m, NAIF lunar kernel set, SVS CGI Moon
  Kit), all URL-verified with pinned SHA-256; reproducible acquisition with provenance
  records; integrity verification; web texture builder; CLI.
- `lunaris-api`: `/health`, runtime report, dataset registry, user-defined candidate
  sites (SQLite via a repository abstraction), error envelope, request ids, CORS.
- `@lunaris/shared-types`: OpenAPI-generated contracts + draft domain contracts.
- `@lunaris/web`: mission-control dashboard (navigation, status, 3D globe with
  disclosed placeholder surface, mission panel, timeline), data-sources page.
- Tests: Python unit/integration (live uvicorn), web units, contract drift, Playwright e2e.

## M02 — Terrain intelligence (next)

**Goal:** real LOLA topography in the analysis and on screen, with slope and roughness
at candidate sites.

1. **Product selection.** Choose site-scale DEMs from the verified shortlist
   (`docs/DATA_SOURCES.md` §3) — e.g. PDS `LDEM_80S_20M` for regional work plus a 5–10 m
   product for landing-site scale. Add manifests with pinned checksums.
2. **PDS3 label parser** (`lunaris_data.ingestion`): parse `OBJECT = IMAGE` and
   `IMAGE_MAP_PROJECTION`; expose dimensions, sample type, scaling, offset, projection
   parameters and reference radius. Test against the verified LDEM_75S_240M label values
   (3812 × 3812, 0.5 m/DN, offsets 1905.5 px, DN range −15529…14049).
3. **DEM reader** (rasterio/GDAL + label metadata): windowed reads returning heights in
   metres with an explicit polar-stereographic CRS; GeoTIFF support for PGDA products.
4. **Projection math** (`lunaris_science.terrain`): forward/inverse south polar
   stereographic on the reference sphere and the point scale factor; property tests and
   the grid-consistency check in `docs/SCIENCE.md` §5.1.
5. **Terrain analysis**: height sampling at sites (bilinear, documented), Horn slope with
   scale-factor-corrected spacing, a defined roughness statistic, footprint statistics,
   configurable hazard thresholds (assumptions) — returning `TerrainAnalysisResult` with
   evidence and provenance.
6. **API**: `GET /api/v1/sites/{id}/terrain` (and a batch variant), contract generated
   into shared-types.
7. **Web**: site panel shows sampled height, slope and roughness with evidence badges and
   DEM provenance; first Plotly chart (elevation profile or slope histogram); a terrain
   tile layer for the south-polar region (hillshade/slope colorization from the DEM).
8. **Validation**: synthetic DEM fixtures with analytically known slopes (planes, cones),
   cross-check against GDAL's slope output, and spot checks on the real product.

**Acceptance:** for a user-defined site, the API returns height/slope/roughness computed
from a checksum-verified LOLA product, every value carries method, resolution and source,
and tests pass in CI.

## M03 — Celestial geometry

SPICE kernel manager and generated meta-kernel; Sun/Earth topocentric azimuth/elevation
and angular radii as time series over the analysis window; explicit aberration
corrections; pole azimuth convention; validation against JPL Horizons (complete the
recorded fixture; bound DE440 vs DE441 differences); the timeline's Sun/Earth lanes and
an ephemeris-driven lighting option in the viewport.

## M04 — Illumination and Earth visibility

Horizon-elevation profiles from DEMs (curvature-correct ray marching), visible solar-disk
fraction, illumination statistics (illuminated fraction, longest darkness), Earth
line-of-sight states and direct-to-Earth visibility windows — always with the statement
that geometric visibility does not imply a radio link. Comparison with published polar
illumination results (Mazarico et al. 2011).

## M05 — Mission intelligence

Mission configurations (persisted), hard constraints, configurable normalized scoring with
per-criterion explanations, sensitivity analysis over weights, side-by-side site
comparison, exportable reports (JSON + human-readable) embedding full provenance and the
runtime toolchain.

## M06 — Hardening and presentation

Performance (terrain tiling, caching of derived products), accessibility pass, Docker
images published, demo dataset bundle instructions, presentation-ready walkthrough for the
NASA Space Apps Challenge.

## Future extension — solar energy estimation

Incident energy on stated panel geometries from validated illumination time series
(`docs/SCIENCE.md` §5.5). Efficiency, temperature and degradation as explicit assumptions.

## Future research track — LUNARIS FIELD (not implemented)

FIELD explores integrating LUNARIS with astronaut visors, cameras and other optical
sensors to help interpret poorly illuminated terrain:

- camera and visor sensor integration and calibration;
- exposure and dynamic-range analysis for extreme lunar lighting;
- low-light visualization and image enhancement that preserves safety-relevant detail;
- terrain and obstacle highlighting;
- fusion of LUNARIS environmental data (terrain, illumination geometry) with imagery;
- astronaut situational-awareness interfaces.

This is a research direction, **not** a validated capability. No FIELD code, interfaces or
dependencies exist in the repository, by design. It would be built as a separate
application on top of `lunaris-science` and `lunaris-data`, after the MISSION modules it
depends on (terrain, geometry, illumination) are validated.

## Open decisions for the team

- License for the repository (currently unlicensed — all rights reserved until chosen).
- Which candidate landing regions to curate as cited, published sites (with sources).
- Target deployment (local demo only vs hosted instance) for M06.
