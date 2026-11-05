# LUNARIS — Scientific methodology

This document defines the conventions LUNARIS uses, the calculations it implements,
and the methods planned for later milestones. It is the reference for reviewing any
scientific code in `packages/science`.

> **Scope.** LUNARIS is a preliminary mission-planning and research tool. It is not a
> certified spacecraft landing or operations system, and its outputs must not be used as
> such.

---

## 1. Principles

1. **Never invent measurements.** Every number shown to a user is an observation, a
   derived product, a model output, a calculation, an assumption, or a placeholder —
   and is labeled as such (see §3).
2. **Provenance is preserved end to end.** Datasets are acquired with an acquisition
   record (source URL, byte size, SHA-256, retrieval time, tool version). Results cite
   the exact files and the software versions that produced them.
3. **Conventions are explicit.** Every quantity carries its unit, frame and reference
   surface. Ambiguous words ("altitude", "elevation") are not used without a reference.
4. **Calculations are separated from assumptions.** Configurable thresholds and model
   choices are recorded with every result.
5. **Methods are validated before they are trusted.** Each module ships with tests
   against definitional values and with comparisons to independent references (§6).

---

## 2. Coordinate, time and unit conventions

### 2.1 Body-fixed frames

| Frame | Definition | Use in LUNARIS |
| --- | --- | --- |
| `MOON_ME` | Mean Earth / Polar Axis: +Z along the mean rotation axis, +X toward the mean Earth direction (0° E), +Y toward 90° E. | **Canonical.** All stored and exchanged surface coordinates. LRO/LOLA products are referred to the ME frame (LOLA labels: *"MEAN EARTH/POLAR AXIS OF DE421"*). |
| `MOON_PA` | Principal Axis frame, realized by the JPL lunar ephemeris (DE440 via `moon_pa_de440_200625.bpc`). | Internal to SPICE computations (Milestone 03). |

`MOON_ME` and `MOON_PA` differ by a fixed rotation of **≈104 arcseconds (≈875 m at the
surface)**, computed on 2026-11-04 with `pxform` from the acquired DE440 kernel set.
LUNARIS obtains that rotation from the NAIF lunar frames kernel (`moon_de440_250416.tf`,
which defines `MOON_ME_DE440_ME421`, the ME realization consistent with DE421-based LRO
products) and never hard-codes angles or frame ID integers. Frame **names** are used
throughout; the generic alias IDs changed in the 2025 FK release (in the acquired FK:
`MOON_ME` = 31001, `MOON_PA` = 31000). With that FK loaded, `MOON_ME` → `MOON_ME_DE440_ME421`
is the identity rotation, as `docs/DECISIONS.md` D2 requires.

References: LRO Project and LGCWG (2008); Archinal et al. (2018); NAIF lunar FK comments.

### 2.2 Surface coordinates

| Quantity | Convention |
| --- | --- |
| Latitude | Planetocentric, degrees, closed interval [−90, +90], positive north |
| Longitude | East-positive, degrees, canonical interval [0, 360); inputs in [−180, 360] are accepted at the API and normalized |
| Height | Metres above the reference sphere of radius **R = 1737.4 km** (LOLA product convention; equal to the IAU mean radius). `null` means "not sampled" and is distinct from 0 |
| Cartesian | Body-fixed, metres, right-handed, frame named explicitly |

The reference radius is a *product convention*: ingestion code reads it from each
product's PDS label (for LDEM_75S_240M: radius = height + 1 737 400 m) instead of
assuming the constant in `lunaris_science.constants`.

### 2.3 Local topocentric directions (Milestone 03+)

- **Up** is the outward normal of the reference sphere at the site (radial direction).
- **East** = ẑ × up (normalized); **north** = up × east. ẑ is the `MOON_ME` +Z axis.
- **Azimuth**: clockwise from local north, degrees, [0, 360). **Elevation**: angle above
  the local horizontal plane, degrees. Both are geometric; the Moon has no atmosphere, so
  no refraction model applies.
- **Pole singularity**: east and north are undefined exactly at ±90°. Topocentric
  functions raise `CoordinateError` for latitude exactly ±90° (contract C0, D2); any
  latitude strictly inside (−90, 90) is valid. Near the pole the basis stays well defined
  because it is built from the site's own longitude (east = ẑ × up), so 89.999999° S is
  accepted and tested (`tests/science/geometry/test_bodies.py`).

### 2.4 Time

- At API and UI boundaries: UTC, ISO 8601 with `Z` (fields suffixed `_utc`).
- Inside geometry computations: SPICE ephemeris time (TDB seconds past J2000), converted
  with the leap-seconds kernel (`naif0012.tls`).
- The default UI analysis window is 30 days, which spans one mean synodic month
  (≈ 29.53 d), the period of the lunar day/night cycle.

### 2.5 Units

SI at all boundaries: metres (`_m`), seconds (`_s`), degrees for angles (`_deg`;
radians only internally), bytes (`_bytes`), fractions in [0, 1] (`_fraction`). SPICE
returns kilometres; conversion happens inside `lunaris-science`.

### 2.6 3D scene frame (visualization only)

three.js is Y-up. The scene is `MOON_ME` rotated −90° about X:
`(x, y, z)_scene = (x_ME, z_ME, −y_ME)`, one scene unit = 1737.4 km. This is a proper
rotation, so viewed from +X (the mean Earth direction) with north up, east longitudes
appear on the right. Unit tests pin this mapping
(`apps/web/src/lib/geo/selenographic.test.ts`).

---

## 3. Evidence model

Implemented in `lunaris_science.provenance` and mirrored in the UI's evidence badges.

| Kind | Meaning | Construction rule |
| --- | --- | --- |
| `observation` | Measured data as distributed by the instrument team | Must cite ≥ 1 source |
| `derived_product` | Archived product derived from observations by its producer (e.g. LOLA GDR) | Must cite ≥ 1 source |
| `model` | Output of an authoritative model (e.g. DE440 via SPICE) | Must cite ≥ 1 source |
| `calculation` | Computed by LUNARIS | Must name its method |
| `assumption` | Adopted by configuration or convention | Must state the assumption |
| `placeholder` | Stand-in content | Never decision-grade |

The rules are enforced at construction time, so an "observation" without a source cannot
exist in memory. The UI adds one display-only state, **not computed**, for values whose
module is not implemented.

---

## 4. Calculations implemented in Milestone 01

All are definitional geometry; none uses observational data.

**Longitude normalization** (`normalize_east_longitude_deg`):
λ ↦ fmod(λ, 360) shifted into [0, 360); −0 and values rounding to 360 map to 0.

**Spherical → Cartesian** (`spherical_to_cartesian`), for latitude φ, east longitude λ and
radius r:

```
x = r cos φ cos λ
y = r cos φ sin λ
z = r sin φ
```

**Cartesian → spherical** (`cartesian_to_spherical`): φ = atan2(z, √(x² + y²)),
λ = atan2(y, x) mod 360°, r = |(x, y, z)|. Using `atan2` keeps latitude well-conditioned
near the poles, where `asin(z / r)` loses precision (tested 1 mm from the pole).

**Site body-fixed position** (API `body_fixed_position`): the conversion above at
r = 1737.4 km with the explicit, labeled assumption *h = 0 m (height not sampled)*.

Tests: `tests/science/test_coordinates.py` (exact axis values, normalization edge cases,
round-trip property tests with Hypothesis), `tests/science/test_provenance.py`.

---

## 5. Planned methods

These are designs, not implementations. Each module ships only when its validation
(§6) passes. The accepted architectural decisions that govern them are in
`docs/DECISIONS.md`: D2 (geometry engine), D3 (terrain resolutions), D4 (illumination and
Earth visibility), D5 (terrain scene).

### 5.1 Terrain intelligence — Milestone 02

**Input (D3).** Horizon masks from the 240 m PDS GDR (`LDEM_75S_240M`); slope, roughness
and hazards from the PGDA 20 m south-pole DEM read as windows around each site through GDAL
`/vsicurl/`, or a PGDA 5 m per-site DEM where one covers the site. See `docs/DATA_SOURCES.md`.

**Reading.** Parse the PDS3 label (projection, offsets, scaling, units, reference
radius); never hard-code those values. The `LDEM_75S_240M` label (acquired 2026-11-04)
defines **HEIGHT = DN × SCALING_FACTOR** (0.5 m) relative to a reference sphere of radius
OFFSET (1 737 400 m), and **PLANETARY_RADIUS = DN × SCALING_FACTOR + OFFSET**. Adding OFFSET
therefore yields a radius, not a height. These heights are relative to the sphere, not to
a geoid (the label's "planetopotential topography").

Implemented by `lunaris_data.pds3` (ODL label parser) and
`lunaris_data.readers.ldem.read_ldem_polar` (T-11), which return a
`lunaris_science.terrain.dem.PolarDem`: float32 heights in metres above the sphere, NaN
where the label's `MISSING_CONSTANT` applies (LDEM_75S_240M declares none), never zero.
The reader refuses a product unless it is polar stereographic, centred on −90°/0°,
planetocentric, east-positive, unrotated, on a sphere whose radius equals `OFFSET`, in
"MEAN EARTH/POLAR AXIS OF DE421", with a file size matching the label and DNs within
`DERIVED_MINIMUM`/`DERIVED_MAXIMUM`. Bilinear sampling returns NaN outside the grid or
next to a missing cell.

**Projection.** Polar stereographic on a sphere of radius R (Snyder 1987). For the south
pole, the radial distance of latitude φ from the pole in the projection plane is

```
ρ(φ) = 2R · tan(45° + φ/2)          (φ ≤ 0)
```

with point scale factor k(φ) = 2 / (1 − sin φ), equal to 1 at the pole (k(75° S) ≈ 1.0173).
Implemented in `lunaris_science.terrain.polar_stereographic` (T-10).

*Axis orientation.* Map x = ρ sin λ, y = ρ cos λ: longitude 0° straight up, 90° E to the
right, which is the south pole seen from outside the Moon (map x ∥ +Y_ME, map y ∥ +X_ME).
For a polar LOLA image the centre of the pixel with **0-based** (line, sample) is at
x = (sample − SAMPLE_PROJECTION_OFFSET) · MAP_SCALE, y = −(line − LINE_PROJECTION_OFFSET) ·
MAP_SCALE. This follows the prose and the inverse equations of the GDR projection
description `DSMAP_POLAR.CAT` and PROJ's `+proj=stere +lat_0=-90 +lon_0=0`. The same
catalogue file's forward equation multiplies R by SIGN(LAT), which for the south would
mirror the sample axis; LUNARIS does not follow it. The choice is pinned by
`tests/science/test_polar_stereographic.py::test_orientation_against_independent_pgda_geotiff`:
at 8 points, LDEM_75S_240M heights at the pixels this convention selects agree with the
co-located 240 m footprint of the independently georeferenced PGDA 20 m GeoTIFF to < 5 m,
while the mirrored-sample and flipped-line conventions are off by 300 m (median) to 8 km
(fixture `tests/fixtures/terrain/ldem-75s-240m-orientation.json`, captured 2026-11-04).

*Consistency with the label grid (asserted in tests):* for LDEM_75S_240M,
ρ(−75°) = 2 · 1737.4 km · tan 7.5° = 457.47 km, within one pixel of the grid half-width
1906 px × 240 m = 457.44 km; the pole falls exactly at the grid centre (0-based pixel
1905.5, 1905.5), and the edge midpoints lie at 75.00° S.

**Slope** (implemented, T-14: `lunaris_science.terrain.analysis`). Horn (1981) 3 × 3 finite
differences on the projected grid. The ground spacing is MAP_SCALE / k, where
k = 1 + (ρ/2R)² is evaluated at each pixel. Slope = atan(√((∂h/∂x)² + (∂h/∂y)²)). The
**baseline** of a slope is 2 × ground spacing, the distance between the pixel centres the
operator differences (≈ 40 m on the PGDA 20 m DEM). Validated on synthetic planes and cones
to < 0.1°; at ρ = 400 km (k = 1.0133) the correction changes a 30° slope by 0.33° (29.67° uncorrected). With
projected spacing the operator equals `gdaldem slope`: < 10⁻³° on a synthetic grid, and
5 × 10⁻⁴° (float32 rounding) over 996 004 cells of a real PGDA window at 89.45° S,
222.69° E.

**Roughness** (implemented). RMS of the height residuals after removing the least-squares
plane fitted to the cells whose centres lie within a circle of ground diameter D around the
site. **Baseline** = D, which is 2 × the footprint radius in `GET /sites/{id}/terrain`.

**Footprint statistics.** Over cells within the footprint radius: cell count, missing
cells (counted, never filled), height min/mean/max, and slope mean / p95 / max.

**Hazard indicators.** Returned only when the caller supplies thresholds (`max_slope_deg`,
`max_roughness_m`): fraction of footprint cells above the slope limit, whether the p95
slope exceeds it, and whether roughness exceeds its limit. Thresholds are mission-specific
**assumptions**, echoed as `assumption` evidence; LUNARIS ships no default "safe slope".

**Source.** `GET /api/v1/sites/{id}/terrain` reads a window of the PGDA 20 m DEM around
the site (`pgda-lola-20mpp-80s`, docs/DATA_SOURCES.md §2.4). The window is about
2 × radius + 8 cells and is cached under `data/processed/`.

**Known limitations.** DEM resolution bounds detectable hazards (boulders and small
craters below the grid spacing are invisible); polar products contain interpolated areas
between altimetry tracks; PGDA/PDS products differ in processing and must not be mixed
without noting it.

### 5.2 Celestial geometry — Milestone 03 (implemented: T-20, T-21)

Code: `lunaris_science.geometry` (`spice`, `epochs`, `bodies`). Tests:
`tests/science/geometry/`.

**Kernels (T-20).** `naif0012.tls`, `pck00011.tpc`, `de440s.bsp`,
`moon_pa_de440_200625.bpc`, `moon_de440_250416.tf` (see `docs/DATA_SOURCES.md`). The API
builds the kernel set from the data store by manifest: every file is re-hashed against its
acquisition record and the SHA-256 pinned in the manifest, and the set is refused on any
mismatch (`lunaris_data.kernels.load_verified_kernel_set`). The science core
then furnishes exactly those absolute paths, in the order LSK, text PCK, SPK, binary PCK,
FK; it does no other I/O. On load it checks that `MOON_ME` is a TK alias of
`MOON_ME_DE440_ME421` with an identity rotation (deviation 0 in every element), and
records the time span covered by every kernel (the DE440s SPK for Sun, Earth and Moon and
the DE440 lunar binary PCK, minus a 1 h margin for light-time iterations: 1849-12-26 to
2150-01-21).

**Thread safety.** CSPICE has one kernel pool per process and is not thread-safe.
Every SPICE call runs inside `SpiceContext.session()`, which holds one process-wide
re-entrant lock. Loading a new kernel set invalidates every earlier context, which then
refuses to compute instead of silently using another pool.

**Method (T-21).**

1. Observer position **s** in `MOON_ME` at radius
   R = 1 737 400 m + surface height + observer height. If the surface height has not
   been sampled, the site is placed on the sphere (h = 0) and that assumption is reported.
2. Apparent target position relative to the observer: CSPICE
   `spkcpo(target, et, 'MOON_ME', 'OBSERVER', 'CN+S', s, 'MOON', 'MOON_ME')`, i.e.
   converged Newtonian light time plus stellar aberration, observer fixed in `MOON_ME`,
   output frame evaluated at the observer epoch.
3. Local east-north-up basis from the reference-sphere radial direction (§2.3, C0);
   azimuth = atan2(E, N) mod 360° (clockwise from north), elevation = asin(U / |r|).
4. Angular radius α = asin(R_body / |r|), with R_body read from the loaded PCK by
   `bodvrd`: Sun 695 700 km; Earth equatorial radius 6378.1366 km (pck00011 polar radius
   6356.7519 km; using the equatorial radius overstates α⊕ by at most 0.34 %, ≈ 0.003°).
5. `direction_moon_me` is the apparent unit vector **r** / |**r**| in `MOON_ME`.

Epochs are a uniform UTC grid (start + k·step); each sample is converted to ET through the
leap-seconds kernel, so a leap second inside a window is honoured (tested at
2016-12-31T23:59:60).

**Independent cross-check.** CSPICE `azlcpo('ELLIPSOID', target, et, 'CN+S', azccw=False,
elplsz=True, …)` uses its own topocentric frame. It agrees with the method above to
< 1 µas in azimuth (scaled by cos el) and elevation, and to 1e-12 relative in range, at
four sites (including 89.9° S with h = +1500 m) and both bodies.

**Validation against JPL Horizons and its tolerance (D2).** Fixtures
`data/fixtures/validation/horizons-{sun,earth}-s89p5-e0-2026-11-04.json` hold 25 hourly
samples each (site 89.5° S, 0° E, h = 0 on the 1737.4 km sphere, 2026-11-04 00:00 →
11-05 00:00 UTC, `QUANTITIES='4'`, `EXTRA_PREC='YES'`), with the exact request URL and
the verbatim `$$SOE…$$EOE` block. Measured differences (LUNARIS − Horizons):

| Body | max abs Δaz · cos el | max abs Δel |
| --- | ---: | ---: |
| Sun | 0.00003″ | < 0.00001″ |
| Earth | 0.0017″ | 0.0002″ |

**Tolerance: 0.01″** in Δaz·cos el and in Δel, for both bodies. Justification:

- *Resolution of the reference.* Horizons prints 1e-9° (0.0000036″) with `EXTRA_PREC`, so
  the comparison is not limited by rounding.
- *Model differences.* Horizons uses DE441 and corrects for gravitational light
  deflection by the Sun and the Earth; LUNARIS uses DE440s and `CN+S`, which has no
  deflection term. DE440 and DE441 are fitted to the same modern observations
  (Park et al. 2021). Neither difference was separated here: the measured residuals above
  bound their combined effect at this site and epoch. The larger Earth residual is
  consistent with the Earth being much closer than the Sun, so any position or deflection
  difference subtends a larger angle.
- *Margin.* 0.01″ is about 6× the largest measured difference, so the test fails on any
  real regression (a wrong correction, frame or azimuth convention moves the result by
  arcseconds or more; switching `CN+S` to `LT` fails it) without being sensitive to the
  ephemeris version.
- *Relevance.* 0.01″ is 1/96 000 of the solar angular radius (≈ 960″), far below what
  matters for disk fractions or visibility windows.

On the fixture day the Earth is below the astronomical horizon at this site
(elevation −1.16° to −2.61°), which the tests also pin.

**Angular sizes.** Solar angular radius ≈ 0.267° at 1 au; Earth angular radius roughly
0.9°–1.0° over the lunar orbit. Both are computed per epoch, never fixed.

**Performance.** One year of hourly samples (8 760 epochs) for the Sun and the Earth,
including UTC → ET conversion, runs in about 1 s on the development machine (acceptance
< 2 s, asserted in `test_one_year_hourly_for_sun_and_earth_takes_under_two_seconds`).

### 5.3 Illumination — Milestone 04

**Geometric illumination**: Sun centre above the local horizontal plane.

**Terrain-aware illumination (horizon method)** after Mazarico et al. (2011):
for each site, compute a horizon-elevation profile H(az) by marching outward along
azimuths over the DEM, including the curvature of the reference sphere (exact 3D
vectors, not a flat-Earth approximation). The DEM extent bounds the farthest obstruction
considered — a stated limitation, important at the poles where distant ridges set the
horizon.

**Horizon mask, implemented (T-15: `lunaris_science.terrain.horizon.compute_horizon_mask`).**
Each azimuth A is marched along the great circle leaving the site in direction
d = cos A · north + sin A · east (C0 frame, radial "up"). The ground point at sphere
distance s is P̂ = cos(s/R) û + sin(s/R) d, so distances are measured on the sphere and need
no map scale-factor correction. Heights h(s) are bilinear LDEM_75S_240M samples. The exact
elevation above the site's radial plane is e(s) = atan2((R+h)cos(s/R) − r_O, (R+h)sin(s/R)),
with r_O = R + h_site + h_observer, and the horizon is max over s of e(s). Defaults: 0.25°
azimuth step, 200 km range, 120 m ray step (half a DEM cell), first sample at 240 m (one
cell, so the cell under the observer is not an obstruction). A ray that meets missing
coverage is flagged `truncated`, and its value is a lower bound.

Validation (`tests/science/test_horizon.py`):
- On a zero-height sphere the mask equals −acos(R/(R+h_obs)) to < 0.01° for h_obs = 2,
  100 and 1000 m.
- On an axisymmetric bowl (rim 2 km high at 20 km) it equals the closed form maximised over
  s to < 0.01°. The curvature term moves that maximum inside the bowl, more than 0.05° from
  the flat-Moon rim angle.
- A wall toward local east raises only the eastern horizon.
- A site at 78° S is truncated toward the north (±15° of north) and not toward the pole.

On the real LDEM a full mask (1440 azimuths × 1667 samples) takes ≈ 2 s. The connecting
ridge (89.45° S, 222.69° E, h_obs = 2 m) gives a horizon of −2.7° … +0.1°; Shackleton's
floor (89.67° S, 129.2° E) gives 19.8° … 23.4°.

**Visible disk fraction (implemented: T-23).** `lunaris_science.illumination.disk_fraction`.
For a disk of apparent angular radius α centred at (A, e) and a horizon profile H(az),
the visible fraction f is the share of the disk's area above H. It is computed for the
Sun (α☉) and the Earth (α⊕), against the terrain horizon (C1 mask) or the flat
astronomical horizon H ≡ 0°.

For a straight horizon this is the circular segment

```
d = clamp((e − H) / α, −1, 1)
f = 1 − (acos(d) − d·√(1 − d²)) / π
```

(f = 0 below, 0.5 when the centre is on the horizon, 1 fully above). Polar horizons are
not straight across a disk of 0.5°–1.9°: crater rims step and slope within that width.
LUNARIS therefore does not assume a straight horizon. In the tangent plane at the disk
centre (x = ΔA·cos e, y = Δel), the disk is cut into chords at x = α·sin θ. Each chord
has half-height h = α·cos θ and visible length clamp(e + h − H(A + x/cos e), 0, 2h). A
midpoint rule over θ with 128 chords gives

```
f = Σ visible(θ_m)·cos θ_m / Σ 2α·cos²θ_m
```

The denominator is the same rule over the whole disk, so f is exactly 0 or 1 when the
disk is fully hidden or fully visible. H is interpolated linearly and periodically in
azimuth (C1).

*Accuracy, all tested (`tests/science/illumination/test_disk_fraction.py`, synthetic
horizons):*

| Case | Reference | Max error |
| --- | --- | ---: |
| Flat horizon, centre on it | 0.5 | < 1e-12 |
| Centre at +α / −α | 1 / 0 | exact |
| Straight horizon (H = 0°, 1.7°, −2.3°), d ∈ [−1.2, 1.2], Sun and Earth | segment formula | < 2e-5 (criterion 1e-3) |
| Horizon sloping 0.4°/° in azimuth | segment at the line distance (e − H₀)/√(1 + s²) | < 1e-3 |
| Step of 0.2° at the disk centre | mean of the two half-disk segments | < 1e-3 |
| Steps at −0.7α … 0.9α, Sun and Earth, 512 chords | brute-force 1201² tangent-plane grid | < 3e-3 (grid resolution) |
| Disk straddling azimuth 0°/360° | brute-force grid | < 3e-3 |

*Approximations.* The tangent-plane description has a relative error of order α²
(≈ 3e-4 for the Earth, 2e-5 for the Sun). Disks reaching beyond ±89° elevation are
rejected. Limb darkening is neglected, so f is a fraction of area, not of flux.

*Truncation (C1, D3).* If any horizon sample that the disk's azimuth span depends on
(through interpolation) is truncated, the result is flagged. The mask elevation there is
only a lower bound, so f is an upper bound and is never reported as exact.

**Timelines and summaries (T-24).** `lunaris_science.illumination.timeline` and
`.analysis`; endpoint `POST /api/v1/analysis/timeline`. For each body, the visible
fraction f is computed at every step against the **astronomical horizon** (H ≡ 0°) and,
when a C1 horizon mask exists, the **terrain horizon**. The two are always reported
separately (C4). Definitions:

| Quantity | Definition |
| --- | --- |
| `mean_visible_disk_fraction` | Time average of f, each sample weighted by its clipped interval. This is the quantity comparable to the "average illumination" of published polar studies. |
| `illuminated_fraction` (Sun) / `visible_fraction` (Earth) | Share of the analysis window (interval-weighted) with f > 0 (any part of the disk visible). Always ≥ the mean. |
| `fully_lit_fraction` / `fully_visible_fraction` | Share of the analysis window with f = 1 (exact by construction: the chord sum is normalised by its own fully-visible value). |
| Sample interval | Each sample stands for [t, t + step) **clipped to the analysis window** [start, end]. With an end-inclusive grid (last epoch = end), the last sample's interval is empty: it carries weight 0. |
| Window | Maximal run of consecutive samples with f > 0, from the first sample's epoch to the end of the last sample's clipped interval. Edges are known to ± step (`resolution_s`). Visible and hidden windows together tile [start, end] exactly (tested). |
| Longest illumination / darkness (Sun), visibility / outage (Earth) | Longest run with f > 0 / f = 0. |
| Censoring | A run that touches the start or end of the analysis window is **censored**: its true duration may be longer. The longest-run flags say so. A whole-window run is always censored. |

Durations are differences of ephemeris time, so they are SI seconds (a leap second inside
the window counts). Truncated terrain samples are counted and reported: there f is an
upper bound (D3).

Tests: `tests/science/illumination/test_timeline.py` (definitions, censoring, leap-second
tolerance, malformed input) and `test_analysis.py` (separate horizons, truncation
surfaced with a count, radio-link disclaimer, and the 2026-11-04 fixture day with the real
kernels: Sun f = 1 at all 25 samples, one sunlit window 00:00 → 11-05 00:00 of exactly 86 400 s censored at both ends; Earth f = 0 at all 25).

**Terrain masks.** Until S-TERRAIN's mask computation (T-15) is merged and served, results
report the astronomical horizon only. `terrain` is null, `terrain_horizon_available` is
false, and a limitation says terrain can hide a body that is above 0°.

### 5.4 Earth visibility — Milestone 04 (implemented: T-24)

The same disk-fraction method is applied to the Earth (α⊕ per epoch). The line-of-sight
state per epoch (`lunaris_science.visibility.classify_line_of_sight`) is:

| State | Condition |
| --- | --- |
| `clear` | f > 0 against the horizon used (the terrain horizon when a mask exists, otherwise the astronomical horizon). From a peak the terrain horizon can dip below 0°, so `clear` is possible with the whole disk below the astronomical horizon. |
| `terrain_obstructed` | f > 0 against the astronomical horizon, f = 0 against the terrain horizon. |
| `below_geometric_horizon` | f = 0 against both. |

Direct-to-Earth geometric visibility windows are the runs with f > 0 (definitions above).

**Geometric visibility is necessary but not sufficient for communication.** Link budgets,
antenna patterns, pointing, ground-station availability and multipath are out of scope.
Every Earth result states this as its first limitation.

### 5.5 Energy estimation — future extension

Incident flux on a stated panel geometry: E = S(d) · f · cos θᵢ with S(d) = S₀ (1 au / d)²
and S₀ ≈ 1361 W m⁻² (Kopp & Lean 2011). Panel efficiency, temperature and degradation
would be explicit, cited assumptions. Not implemented.

### 5.6 Mission intelligence — Milestone 05

Hard constraints are evaluated first: a site that violates one is **excluded**, not
down-weighted. Eligible sites are scored with user-visible normalization and weights
(assumptions recorded with the result), with per-criterion contributions and a
sensitivity analysis over the weights. Placeholder evidence can never contribute.

---

## 6. Validation strategy

| Level | What | Where |
| --- | --- | --- |
| Definitional | Exact values (axes, poles, normalization edge cases) | `tests/science` |
| Property | Round trips and invariants over random inputs (Hypothesis) | `tests/science` |
| Product consistency | Label-derived grid geometry (§5.1 check), DN ranges vs label | M02 |
| Independent ephemeris | Sun/Earth az/el vs JPL Horizons at reference sites/epochs (feasibility shown 2026-11-04, §5.2) | M03, fixture `data/fixtures/validation/` |
| Published results | Illumination and Earth-visibility fractions vs the published LOLA average-visibility maps (Mazarico et al. 2011) at the catalogue sites, with stated differences in DEM, period, method and point sampling (below) | M04, T-25 |
| Reproducibility | Acquisition records + `GET /api/v1/system/runtime` versions embedded in results | all |

**Horizons references (captured 2026-11-04).** `data/fixtures/validation/horizons-sun-s89p5-e0-2026-11-04.json`
and `horizons-earth-s89p5-e0-2026-11-04.json`: 25 hourly apparent az/el samples each,
requested directly from the Horizons API by the development environment, with the exact
request URL and the verbatim `$$SOE…$$EOE` table. They replace an earlier two-sample Sun
fixture that had been relayed second-hand. Tolerance and its justification: §5.2.

**Published illumination references (T-25).** `data/fixtures/validation/published-illumination.json`
is built by `build_published_illumination.py` (same directory) from the PDS LOLA EXTRAS
products `AVGVISIB_65S_240M` and `AVGVISIB_65S_240M_EARTH` (Mazarico et al. 2011; SHA-256
recorded per entry). For each catalogue site it records the value of the 240 m pixel
containing the reference point, and the 3 × 3 (720 m) spread.

- *Definition (labels, verbatim in the fixture).* The fraction of hourly samples,
  2001-01-01 → 2018-08-08, with any part of the Sun (or the Earth) visible. Both are
  extended sources. This is LUNARIS's `illuminated_fraction` / `visible_fraction` against
  the terrain horizon (§5.3), not the mean disk fraction.
- *Orientation.* Both labels state `CENTER_LATITUDE = 90`, but the data are south polar.
  The fixture uses the LOLA GDR orientation (§5.1). Against LDEM_75S_240M local relief
  (height minus its 21-pixel mean), the correlation is +0.35 as oriented and below 0.02
  in magnitude for every flip, transpose and 180° rotation.
- *Local variability.* On ridges the published value changes by tens of percent within
  720 m (Site01: 0.41–0.77). Agreement is therefore judged against that spread
  (`lunaris_science.illumination.validation.compare`).
- *Differences that are always stated.* Period (the 18.6-year cycle versus the computed
  window), DEM and resolution, observer height (not stated in the labels), sampling
  step, point sampling, and horizon truncation (then the computed value is an upper
  bound).
- *Also recorded.* Barker et al. (2021) (PGDA product 78, verbatim): Site 1 has the most
  area with average illumination > 70 % at 1 m, 2024-01-01 → 2026-01-01. This is a
  qualitative consistency check, satisfied by the published map (Site01 pixel 0.768).
  Point values from the paper tables of Mazarico et al. (2011), Gläser et al. (2014) and
  Barker et al. (2021) are recorded as **unavailable**: the publishers, doi.org and NTRS
  are not reachable from the development environment. No value is quoted from memory.
- *Status.* The harness is tested against synthetic masks. The comparison of LUNARIS's
  terrain-horizon results with these references needs real horizon masks (S-TERRAIN
  T-15).

---

## 7. References

- Acton, C. H. (1996). Ancillary data services of NASA's Navigation and Ancillary
  Information Facility. *Planetary and Space Science*, 44(1), 65–70. doi:10.1016/0032-0633(95)00107-7
- Annex, A. M., et al. (2020). SpiceyPy: a Pythonic Wrapper for the SPICE Toolkit.
  *Journal of Open Source Software*, 5(46), 2050. doi:10.21105/joss.02050
- Archinal, B. A., et al. (2018). Report of the IAU Working Group on Cartographic
  Coordinates and Rotational Elements: 2015. *Celestial Mechanics and Dynamical
  Astronomy*, 130, 22. doi:10.1007/s10569-017-9805-5
- Barker, M. K., et al. (2021). Improved LOLA elevation maps for south pole landing sites:
  Error estimates and their impact on illumination conditions. *Planetary and Space
  Science*, 203, 105119. doi:10.1016/j.pss.2020.105119
- Barker, M. K., et al. (2023). *The Planetary Science Journal*, 4, 183.
  doi:10.3847/PSJ/acf3e1
- Gläser, P., et al. (2014). Illumination conditions at the lunar south pole using high
  resolution Digital Terrain Models from LOLA. *Icarus*, 243, 78–90.
- Horn, B. K. P. (1981). Hill shading and the reflectance map. *Proceedings of the IEEE*,
  69(1), 14–47. doi:10.1109/PROC.1981.11918
- Kopp, G., & Lean, J. L. (2011). A new, lower value of total solar irradiance: Evidence
  and climate significance. *Geophysical Research Letters*, 38, L01706. doi:10.1029/2010GL045777
- LRO Project and LGCWG (2008). *A Standardized Lunar Coordinate System for the Lunar
  Reconnaissance Orbiter and Lunar Datasets* (white paper).
- Mazarico, E., Neumann, G. A., Smith, D. E., Zuber, M. T., & Torrence, M. H. (2011).
  Illumination conditions of the lunar polar regions using LOLA topography. *Icarus*,
  211(2), 1066–1081. doi:10.1016/j.icarus.2010.10.030
- McEwen, A. S. (1991). Photometric functions for photoclinometry and other applications.
  *Icarus*, 92(2), 298–311. doi:10.1016/0019-1035(91)90053-V (Lunar-Lambert function used
  for *display shading only*.)
- Park, R. S., Folkner, W. M., Williams, J. G., & Boggs, D. H. (2021). The JPL Planetary
  and Lunar Ephemerides DE440 and DE441. *The Astronomical Journal*, 161(3), 105.
  doi:10.3847/1538-3881/abd414
- Smith, D. E., et al. (2010). The Lunar Orbiter Laser Altimeter Investigation on the
  Lunar Reconnaissance Orbiter Mission. *Space Science Reviews*, 150, 209–241.
  doi:10.1007/s11214-009-9512-y
- Snyder, J. P. (1987). *Map Projections — A Working Manual*. USGS Professional Paper 1395.
