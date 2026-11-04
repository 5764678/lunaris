# LUNARIS — Roadmap

LUNARIS has two branches: **MISSION** (current development) and **FIELD** (a future
research direction, not implemented). Milestones are delivered in order; each module
ships only with its validation. Accepted architectural decisions are recorded in
`docs/DECISIONS.md` (D1–D7) and govern the plans below.

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
  records — proven against the real NASA archives on 2026-11-04 (all checksums matched);
  integrity verification; web texture builder; CLI.
- `lunaris-api`: `/health`, runtime report, dataset registry, user-defined candidate
  sites (SQLite via a repository abstraction), error envelope, request ids, CORS.
- `@lunaris/shared-types`: OpenAPI-generated contracts + draft domain contracts.
- `@lunaris/web`: mission-control dashboard (navigation, status, 3D globe with
  disclosed placeholder surface, mission panel, timeline), data-sources page.
- Tests: Python unit/integration (live uvicorn), web units, contract drift, Playwright e2e.

## M02 — Terrain intelligence (next)

**Goal:** real LOLA topography in the analysis and on screen, with slope and roughness
at candidate sites.

1. **Products (D3).** Horizon masks from `LDEM_75S_240M` (acquired and verified in M01).
   Slope, roughness and hazards from the PGDA 20 m DEM (`LDEM_80S_20MPP_ADJ.TIF`) read as
   windows around each site via GDAL `/vsicurl/`; PGDA product 78 5 m per-site DEMs where
   they cover a site. Extend the manifest model with a **remote windowed source** kind
   (URL, byte size, HTTP validators, header checksum) and record provenance per window
   read. Fallback if `/vsicurl/` proves unreliable: crop windows once into `data/processed/`.
2. **PDS3 label parser** (`lunaris_data.ingestion`): parse `OBJECT = IMAGE` and
   `IMAGE_MAP_PROJECTION`; expose dimensions, sample type, scaling, offset, projection
   parameters and reference radius. Test against the acquired LDEM_75S_240M label
   (3812 × 3812, HEIGHT = DN × 0.5 m, PLANETARY_RADIUS = HEIGHT + 1 737 400 m, offsets
   1905.5 px, DN range −15529…14049).
3. **DEM readers** (rasterio/GDAL + label metadata): PDS IMG and (Big)GeoTIFF windowed
   reads returning heights in metres; verify from file metadata that each product is south
   polar stereographic `MOON_ME` (DE421) and refuse a mismatch (D3).
4. **Projection math** (`lunaris_science.terrain`): forward/inverse south polar
   stereographic on the reference sphere and the point scale factor; property tests and
   the grid-consistency check in `docs/SCIENCE.md` §5.1.
5. **Terrain analysis**: height sampling at sites (bilinear, documented), Horn slope with
   scale-factor-corrected spacing, a defined roughness statistic, footprint statistics,
   configurable hazard thresholds (assumptions) — returning `TerrainAnalysisResult` with
   evidence and provenance. Every slope and roughness value carries its `baseline_m` (D3).
6. **API**: `GET /api/v1/sites/{id}/terrain` (and a batch variant), plus a heightmap export
   for the polar scene (D5); contracts generated into shared-types.
7. **Web**: the **south-pole terrain scene** — a mesh built from LOLA heights — becomes
   the main 3D view, with the globe kept as context and entry point (D5). Until M03 it uses
   the labeled display light; rendered shadows are always labeled as illustration. The site
   panel shows sampled height, slope and roughness with evidence badges and DEM
   provenance; first Plotly chart (elevation profile or slope histogram).
8. **Validation**: synthetic DEM fixtures with analytically known slopes (planes, cones),
   cross-check against GDAL's slope output, and spot checks on the real product.

**Acceptance:** for a user-defined site, the API returns height/slope/roughness computed
from a checksum-verified LOLA product, every value carries method, resolution and source,
and tests pass in CI.

## M03 — Celestial geometry

SPICE kernel manager and generated meta-kernel; Sun/Earth topocentric azimuth/elevation
and angular radii as time series over the analysis window; light-time and stellar
aberration corrections; an explicit rejection or azimuth convention at latitude ±90°, never
a silent NaN; a committed test that `MOON_ME` resolves to `MOON_ME_DE440_ME421` (D2).
Validation against JPL Horizons: complete the recorded fixture and state the tolerance
(a scratch cross-check already agrees to < 0.05″ at two epochs). The timeline's Sun/Earth
lanes and SPICE-driven lighting of the terrain scene (D5).

## M04 — Illumination and Earth visibility

Per-site horizon masks from `LDEM_75S_240M` (curvature-correct ray marching, truncation
flags for rays leaving coverage), visible solar- and Earth-disk fractions, illumination
statistics (illuminated fraction, longest darkness), Earth line-of-sight states and
direct-to-Earth visibility windows — astronomical and terrain horizons reported separately,
always with the statement that geometric visibility does not imply a radio link (D4).
Validation on synthetic terrain with analytical answers and against Mazarico et al. (2011)
and Gläser et al. (2014).

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
