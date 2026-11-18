# LUNARIS — Architectural Decision Record

Each entry records a decision, the evidence it rests on, and what it costs. Entries are
append-only: a reversed decision gets a new entry that supersedes the old one; the old
one is marked `Superseded by D<n>` and kept.

Owner of this file: the technical-director session. Implementation sessions propose
changes through their PR description; they do not edit accepted entries.

Status values: `Proposed`, `Accepted`, `Superseded by D<n>`.

---

## D1 — Modular monolith on the Milestone 01 stack

- **Status:** Accepted (2026-11-04)
- **Context:** Milestone 01 establishes a monorepo: `apps/web` (Next.js, React Three
  Fiber), `apps/api` (FastAPI), `packages/science` (pure scientific core),
  `packages/data` (manifests, acquisition, verification), `packages/shared-types`
  (TypeScript types generated from the API's OpenAPI document). Module layout and its
  rules are described in `docs/ARCHITECTURE.md`.
- **Decision:** Keep that structure and stack. No microservices, no PostGIS, no task
  queue. Analysis endpoints compute synchronously and cache derived artefacts as files
  under `data/processed/`, keyed by input checksums and parameters. SQLite stays for
  lightweight application state.
- **Why:** The expensive step (a horizon mask per site, D4) takes seconds and is cached;
  a year of hourly SPICE geometry for one site is sub-second. Nothing in scope needs
  asynchronous jobs or spatial SQL.
- **Revisit if:** a request routinely exceeds ~10 s after caching, or regional
  illumination maps (many horizon masks) move into scope.

## D2 — SPICE is the geometry engine; Horizons is a validation oracle only

- **Status:** Accepted (2026-11-04)
- **Decision:** Sun and Earth directions from a lunar surface site are computed locally
  with SpiceyPy from NAIF generic kernels: `naif0012.tls`, `pck00011.tpc`,
  `moon_pa_de440_200625.bpc`, `moon_de440_250416.tf`, `de440s.bsp` (URLs and SHA-256 in
  the NAIF manifest). JPL Horizons is used only to produce test fixtures. The running
  application never calls Horizons.
- **Requirements on the implementation:**
  - Surface positions are in `MOON_ME`. A test must assert that `MOON_ME` in the loaded
    FK resolves to `MOON_ME_DE440_ME421`, the realization consistent with the
    "Mean Earth/Polar Axis of DE421" frame that LOLA products are registered to.
  - No hard-coded integer frame IDs (they changed between FK versions: MOON_PA
    31010 → 31000, MOON_ME 31011 → 31001).
  - Times enter as UTC and are converted to ET/TDB through the leap-seconds kernel.
  - Apparent directions use light-time and stellar aberration correction.
  - The local topocentric frame is undefined at latitude exactly ±90°. The code must
    reject it or define the azimuth reference explicitly; it must not return a silent
    NaN.
  - Validation against the Horizons fixture (site −89.5° lat, 0° E, h = 0 on the
    1737.4 km sphere) uses a tolerance stated and justified in `docs/SCIENCE.md`.
    Horizons used DE441 and we use DE440s, so the tolerance must allow for the
    ephemeris difference.
- **Why:** A live demo cannot depend on a third-party API's availability or rate
  limits. Local SPICE is reproducible and fast.

## D3 — Two terrain resolutions: regional for horizons, high resolution for hazards

- **Status:** Accepted (2026-11-04)
- **Context:**
  - Horizons at the south pole are shaped by terrain up to ~200 km away. At 200 km the
    lunar surface curves away from the site's horizontal plane by d²/2R ≈ 11.5 km, so
    more distant terrain rarely matters.
  - A slope value is only meaningful together with the distance it is measured over.
    A 240 m pixel averages away slopes that matter at lander scale.
  - Products checked 2026-11-04 (HTTP HEAD and remote TIFF header reads):

    | Product | Size | Layout | Partial reads |
    |---|---:|---|---|
    | PDS `ldem_75s_240m.img` (75–90°S, 240 m) | 29,062,688 B | 3812×3812 int16 | n/a (download) |
    | PGDA `LDEM_80S_20MPP_ADJ.TIF` (20 m) | 2,696,082,051 B | BigTIFF 30400², float32, 512² tiles, deflate, IFD at byte 200 | `Accept-Ranges: bytes` |
    | PGDA `LDEM_83S_10MPP_ADJ.TIF` (10 m) | 5,116,709,568 B | BigTIFF 43280², same layout | `Accept-Ranges: bytes` |
    | PGDA product 78 per-site 5 m DEMs (27 sites; e.g. `Haworth_final_adj_5mpp_surf.tif`) | 142,123,767 B (Haworth) | 5960², float32, uncompressed, 1-row strips | `Accept-Ranges: bytes` |

- **Decision:**
  - **Horizon masks** use LDEM_75S_240M.
  - **Slope, roughness and hazard** use the PGDA 20 m DEM, read as a window around each
    site through GDAL `/vsicurl/`. The PGDA 5 m site DEM is used where one covers the
    site.
  - Every slope or roughness value carries its baseline (for example
    `slope_deg` with `baseline_m`).
- **Constraints that follow:**
  - Horizon rays that leave DEM coverage are flagged as truncated. They are never
    treated as zero elevation. With LDEM_75S_240M, a full 200 km reach in every
    direction needs a site poleward of about 82°S: (lat − 75°) × 30.3 km/° ≥ 200 km.
  - Distances measured on the polar stereographic grid are corrected for scale (about
    1.7% at 75°S, k = 2 / (1 + sin|φ|)) or computed on the sphere.
  - Both products are south polar stereographic, MOON_ME (DE421). Readers verify this
    from file metadata and refuse a mismatch.
- **Fallback:** if `/vsicurl/` windowed reads prove unreliable, crop windows once into
  `data/processed/`, or download the per-site 5 m tiles.
- **Rejected:** a single 240 m DEM, because its hazard numbers can't be defended.
  20 m everywhere, because horizon computation would need multi-GB inputs for no gain
  in accuracy.

## D4 — Illumination and Earth visibility as visible-disk fraction over a horizon mask

- **Status:** Accepted (2026-11-04)
- **Context:** Near the south pole the Sun's elevation stays within about ±1.5–2°, and
  its disk is about 0.53° across. Partial occlusion of the disk by terrain is a
  common state, not an edge case. Earth's disk is about 1.9° across and, seen from
  the polar region, its elevation stays within roughly ±7° because of libration.
- **Decision:**
  1. For each site, compute a terrain horizon mask once: horizon elevation angle as a
     function of azimuth, at a stated azimuth step. Rays are marched over the DEM with
     curvature correction and truncation flags (D3).
  2. At each time step, take the body's apparent azimuth, elevation and angular radius
     (D2). Report the fraction of the body's disk above the horizon mask.
  3. Illumination timelines, Sun-visible windows and direct-to-Earth (geometric)
     visibility windows are derived from those fractions.
- **Semantics:** the astronomical horizon (elevation 0°) and the terrain horizon are
  reported separately. Earth visibility is geometric line of sight only. It does not
  imply a radio link, which would need a link budget.
- **Out of scope, and documented as such:** Earthshine, light scattered from nearby
  terrain, and regional illumination maps (one mask per grid cell; possible later as a
  coarse grid).
- **Validation:** synthetic terrain with analytical answers (flat plane, axisymmetric
  crater), and comparison with published polar illumination studies (Mazarico et al.
  2011; Gläser et al. 2014, both in Icarus). Any agreement is reported with its stated
  differences in DEM, period and method.
- **Rejected:** a point Sun, because it misstates illumination percentage exactly where
  LUNARIS specializes. Per-time-step ray tracing, which costs thousands of times more
  for the same single-site answer.

## D5 — The south-pole terrain scene is the main visualization

- **Status:** Accepted (2026-11-04)
- **Decision:** The main 3D view is a terrain mesh built from LOLA heights around the
  south pole. It is lit by the SPICE Sun direction for the selected time, and a time
  control moves the Sun. The globe remains as context and as the entry point into the
  polar scene.
- **Labelling rule:** shadows rendered by the 3D engine are an illustration. They are
  labelled as such in the interface. Quantitative illumination comes only from D4, and
  the selected site shows its computed value in the 3D view.
- **Why:** the global colour map is most distorted at the poles, exactly where LUNARIS
  works. Real terrain under real Sun geometry is the visual case for the product.
- **Cost:** the largest single frontend task, plus an API endpoint that exports a
  heightmap for the scene.

## D6 — Documentation set

- **Status:** Accepted (2026-11-04)
- **Decision:** `README.md` plus `docs/` `ARCHITECTURE.md`, `SCIENCE.md`,
  `DATA_SOURCES.md`, `API.md`, `ROADMAP.md` (created in Milestone 01), plus this file
  and `docs/TASKS.md` (task assignments, owners, acceptance criteria). No separate
  `PROJECT.md`: the project vision and scope live in `README.md` and `docs/ROADMAP.md`.

## D7 — Parallel session organization

- **Status:** Accepted (2026-11-04)
- **Decision:**
  - At most four implementation sessions run at once.
  - Each session owns a set of directories, works on its own branch, and opens a PR to
    `main`.
  - Interfaces between sessions are fixed in `docs/API.md` (wire contracts, generated
    OpenAPI) and `docs/SCIENCE.md` (science-core function contracts) before parallel
    work starts.
  - The technical director verifies each PR by running its tests and checks before it
    merges. A session's own completion report is not taken as evidence.
  - Implementation sessions run at high reasoning effort, not max, to fit the usage
    budget.
- **Ownership:** assigned per task in `docs/TASKS.md`.

## D8 — Hosted demo: two Docker services on Render's free plan, data baked into the image

- **Status:** Accepted (2026-11-05)
- **Decision:** The public demo runs as two Render web services built from this repository:
  `apps/api/Dockerfile` and `apps/web/Dockerfile`. A free instance has no persistent disk,
  so the API image acquires the checksum-verified NAIF kernels and LDEM_75S_240M at build
  time (`LUNARIS_BAKE_DATASETS`, with `lunaris-data verify`). It then warms the cited demo
  trio's horizon masks and PGDA windows (`LUNARIS_PREWARM_DEMO`). The web image builds the
  SVS globe texture in its own stage. `NEXT_PUBLIC_LUNARIS_API_URL` and
  `LUNARIS_CORS_ORIGINS` tie the two services together.
- **Costs:**
  - Instances sleep after about 15 minutes idle, and the first request then waits about a
    minute.
  - On the free CPU, the trio comparison over one year takes about 20 s.
  - Sites registered at runtime are lost when the instance restarts. The image ships with
    the trio registered.
  - The image is about 72 MB of data larger than one without the baked datasets.
- **Revisit if:** the comparison becomes the demo's bottleneck (move the API to a paid
  instance), or user-registered sites must persist (attach a disk or a database).

## D9 — Comparison summary: dominance and declared directions, no hidden weights

- **Status:** Accepted (2026-11-05)
- **Context:** Users want the comparison to say which site is best. "Best" depends on
  mission weights: power, communications and landing safety each give a different winner. A
  default weighted score would present a value judgment as a measurement.
- **Decision:**
  - Each comparable column declares its direction, higher or lower is better, with a
    rationale. Columns with no universal direction, such as horizon elevation, declare none.
  - The API reports the column leaders and each site's leads, trails and Pareto dominance.
    It also returns a verdict sentence generated only from that dominance, which says so
    when there is no clear winner.
  - A weighted ordering exists only when the user selects a named mission profile. Its
    weights and normalisation are shown and returned as `assumption` evidence. Without a
    profile there is no score.
- **Rejected:** a default "suitability score". It is easy to read, and nobody can defend
  its weights.
- **Amended (2026-11-14, at the owner's request; ported from the `lunarseye` repository):** the
  optional profile score is replaced by a mission recommendation. The Compare page asks what the
  mission needs (power, comms, landing: not needed / nice to have / important / critical) and
  four optional hard limits (steepest slope, longest darkness, longest Earth outage, unbroken
  sunlight). `summary.recommendation` names one site, with reasons, what it gives up, a lead-based
  confidence and the priority changes that would flip it. Sites that break a limit are excluded
  with the reason, never down-weighted. Scores use fixed reference scales, so adding or removing a
  site never changes another site's score. The verdict and standings above are unchanged and
  still use no weights. What stays true from this decision: every weight, scale and limit is
  returned and shown as `assumption` evidence, and a missing value means "no score", never 0.
  What does not: there is now a recommendation without the user choosing a profile (every need
  "important", no limits), so the weights are LUNARIS's assumptions, not mission requirements.
  Thermal, dust, resource and trajectory constraints are not scored.

## D10–D14 — Classroom mode (Chulalongkorn Innovative Award entry)

- **Status:** accepted (2026-11-11).
- **Decision:** recorded in full in `docs/classroom/PLAN.md` section 2. In short: lessons
  read a committed, static lesson pack and never the live API (D10); Thai text for the
  whole interface with an English switch, evidence detail text excepted (D11); Moon phases
  are geocentric and labelled as such (D12); the entry claims only what the software does
  (D13); a light, roomier theme with the 3D views kept dark (D14).

## D15 — The web globe texture is committed

- **Status:** accepted (2026-11-18).
- **Context:** the Render build fetches the NASA SVS CGI Moon Kit image to build the globe
  texture. On 18 November that request failed certificate verification in the build
  container, and the live site fell back to the labelled placeholder surface.
- **Decision:** commit the two built files (`apps/web/public/textures/moon/moon-color.jpg`,
  1.8 MB, and its `manifest.json`). They are a derived, public-domain web asset with full
  provenance, like the lesson pack, not a science dataset. The build stage is kept and
  overwrites them when it succeeds.
- **Rejected:** disabling certificate verification in the downloader.

