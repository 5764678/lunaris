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

**Projection.** Polar stereographic on a sphere of radius R (Snyder 1987). For the south
pole, the radial distance of latitude φ from the pole in the projection plane is

```
ρ(φ) = 2R · tan(45° + φ/2)          (φ ≤ 0)
```

with point scale factor k(φ) = 2 / (1 − sin φ), equal to 1 at the pole. Axis orientation
follows the label's map-projection definition and is pinned by tests against known
pixels.

*Consistency check (computed here, to be asserted in M02 tests):* for LDEM_75S_240M,
ρ(−75°) = 2 · 1737.4 km · tan 7.5° ≈ 457.5 km ≈ 1906 px × 240 m, consistent with the
3812 × 3812 grid and the 1905.5 px projection offsets in its label.

**Slope.** Horn (1981) 3 × 3 finite differences on the projected grid, with the ground
sample distance corrected by the scale factor (240 m / k at the pixel). Slope =
atan(√((∂h/∂x)² + (∂h/∂y)²)). Reported with the baseline (3 pixels) and resolution.

**Roughness.** A defined statistic over a stated baseline (candidate: RMS of residual
heights after removing a best-fit plane within a circular window). The definition, window
and resolution are part of every result.

**Hazard indicators.** Threshold classification (slope above a configured limit, fraction
of footprint above it). Thresholds are mission-specific **assumptions**, returned with the
result; LUNARIS ships no default "safe slope".

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

**Visible solar-disk fraction.** With d = (e☉ − H(az☉)) / α☉, clamp d to [−1, 1]:

```
f = 1 − (acos(d) − d·√(1 − d²)) / π
```

(f = 0 below, 0.5 when the centre is on the horizon, 1 fully above). Assumptions: the
horizon is locally straight across the disk; limb darkening is neglected.

**Outputs.** Time series of f; illuminated fraction; longest continuous darkness and
illumination; each with the window, step, ephemeris and DEM provenance. The astronomical
horizon (0°) and the terrain horizon are reported separately; rays that leave DEM coverage
are flagged as truncated, never treated as zero elevation (D3, D4). Out of scope:
earthshine, light scattered from nearby terrain, and regional illumination maps.

### 5.4 Earth visibility — Milestone 04

The same horizon profile is applied to the Earth's centre (and disk fraction using α⊕).
Outputs: line-of-sight state per epoch (`clear` / `terrain_obstructed` /
`below_geometric_horizon`) and direct-to-Earth visibility windows.

**Geometric visibility is necessary but not sufficient for communication.** Link budgets,
antenna patterns, pointing, ground-station availability and multipath are out of scope;
every result states this.

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
| Published results | Polar illumination fractions vs Mazarico et al. (2011) and Gläser et al. (2014), with stated differences in DEM, period and method | M04 |
| Reproducibility | Acquisition records + `GET /api/v1/system/runtime` versions embedded in results | all |

**Horizons references (captured 2026-11-04).** `data/fixtures/validation/horizons-sun-s89p5-e0-2026-11-04.json`
and `horizons-earth-s89p5-e0-2026-11-04.json`: 25 hourly apparent az/el samples each,
requested directly from the Horizons API by the development environment, with the exact
request URL and the verbatim `$$SOE…$$EOE` table. They replace an earlier two-sample Sun
fixture that had been relayed second-hand. Tolerance and its justification: §5.2.

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
