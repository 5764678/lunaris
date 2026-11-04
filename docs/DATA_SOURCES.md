# LUNARIS — Data sources and provenance

LUNARIS uses real NASA lunar data products. None of them are committed to this
repository: each is described by a version-controlled **manifest** and acquired
reproducibly with `uv run lunaris-data acquire <dataset-id>`.

## 1. Provenance rules

1. **Manifests describe data, never contain it.** One JSON file per dataset in
   `packages/data/src/lunaris_data/manifests/`: archive, landing page, file URLs, frame,
   projection, resolution, units, citation, usage terms, and URL verification status.
2. **Acquisition writes a record.** `data/<area>/<dataset-id>/acquisition.json` stores,
   per file, the source URL, final URL after redirects, HTTP validators (ETag,
   Last-Modified), byte size, SHA-256 and retrieval time, plus the manifest fingerprint
   and tool version. Downloads stream to `*.part`, are hashed and verified, and only then
   renamed into place; the record is written last.
3. **Pinned checksums are enforced.** A manifest marked `verified` must pin `sha256` and
   `size_bytes` for every file; acquisition fails on any mismatch and leaves nothing behind.
4. **Unknown provenance is not used.** Files present without an acquisition record are
   reported as `untracked` and never treated as acquired.
5. **Manifest edits are detectable.** If a manifest changes after acquisition, the
   dataset is flagged `manifest_changed` in the registry and the UI.
6. **Integrity can be re-checked at any time.** `uv run lunaris-data verify <id>` re-hashes
   every file against its record and the manifest pins.

Local status values: `missing`, `untracked`, `incomplete`, `acquired`.

## 2. Registered datasets (Milestone 01)

URL verification: all three manifests were **verified on 2026-11-04 by an independent
session with direct archive access** (files downloaded and hashed), then **re-verified the
same day by a full `lunaris-data acquire` + `verify` from the LUNARIS development
environment** — every file matched its pinned SHA-256. Two corrections came out of the
first verification and are reflected below: the lunar frames kernel had been superseded,
and the PDS serves lower-case file names.

### 2.1 `lola-ldem-75s-240m` — LOLA GDR, south polar stereographic, 240 m/px

| Field | Value |
| --- | --- |
| Provider | NASA PDS Geosciences Node — `LRO-L-LOLA-4-GDR-V1.0` |
| Mission / instrument | LRO / LOLA |
| Evidence kind | `derived_product` |
| Coverage / resolution | 75° S – 90° S, 240 m/pixel (nominal) |
| Grid | 3812 × 3812, LSB 16-bit signed integers |
| Projection | Polar stereographic on a 1737.4 km sphere, centre −90° / 0°, east-positive; line/sample projection offsets 1905.5 px |
| Heights | Label: HEIGHT = DN × 0.5 m relative to the 1737.4 km sphere; PLANETARY_RADIUS = DN × 0.5 + 1 737 400 m (OFFSET is the sphere radius); DN range −15529 … 14049 |
| Frame | "MEAN EARTH/POLAR AXIS OF DE421" |
| Files | `LDEM_75S_240M.LBL` (4 990 B, `ec07239f41d8abc1a3681495b5799b770c7206b5268b76721d69180df0422e02`) · `LDEM_75S_240M.IMG` (29 062 688 B, `d031efe2611b17dfbf3c158f5e15dc04cd5719349dcbf6384bb21fd97697c490`) |
| URLs | `https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_75s_240m.{lbl,img}` |
| Citation | Smith, D. E., et al. (2010), *Space Sci. Rev.* 150, 209–241, doi:10.1007/s11214-009-9512-y; PDS data set LRO-L-LOLA-4-GDR-V1.0 |

The server publishes lower-case names, but the label's `^IMAGE` pointer names
`LDEM_75S_240M.IMG`; LUNARIS stores files under the upper-case names so the pointer
resolves on case-sensitive file systems. 240 m/px is regional context only (see §3).

### 2.2 `naif-generic-kernels-lunar` — SPICE kernels for lunar geometry

| File | Purpose | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `lsk/naif0012.tls` | Leap seconds (UTC ↔ TDB) | 5 257 | `678e32bdb5a744117a467cd9601cd6b373f0e9bc9bbde1371d5eee39600a039b` |
| `pck/pck00011.tpc` | IAU radii and orientation | 131 226 | `3dff7b1dbeceaa01f25467767d3fa25816051c85d162d1edf04acb310ee28bb1` |
| `spk/planets/de440s.bsp` | DE440 ephemeris, short span | 32 726 016 | `c1c7feeab882263fc493a9d5a5b2ddd71b54826cdf65d8d17a76126b260a49f2` |
| `pck/moon_pa_de440_200625.bpc` | Lunar orientation (PA), DE440 | 12 863 488 | `60cd55aa401ea2ea97360636f567554bfe4e37bb829f901b4460a455dfaf783f` |
| `fk/satellites/moon_de440_250416.tf` | Lunar frames (PA/ME) | 19 478 | `a47c71e9c9f33796bdafb2c9d69a7ee447b6016ecad80f71cd6f3e479f9cf768` |

Base URL: `https://naif.jpl.nasa.gov/pub/naif/generic_kernels/`. Evidence kind: `model`.

Notes from verification:
- `moon_de440_220930.tf` was superseded by `moon_de440_250416.tf`. Frame names are
  unchanged (`MOON_PA`, `MOON_ME`, `MOON_PA_DE440` 31008, `MOON_ME_DE440_ME421` 31009),
  but the generic alias IDs changed (`MOON_PA` 31010→31000, `MOON_ME` 31011→31001).
  LUNARIS refers to frames by name only.
- DE442 (`de442s.bsp`) exists, but NAIF publishes no DE442-consistent lunar PCK/FK, so
  LUNARIS keeps the internally consistent DE440 set.
- The `de440s.bsp` MD5 also matched NAIF's `aa_checksums.txt`.
- With the acquired set loaded in CSPICE N0067, `MOON_ME` resolves to
  `MOON_ME_DE440_ME421` (identity rotation) and the PA↔ME rotation is ≈104″ (≈875 m at
  the surface).

Citations: Acton (1996), doi:10.1016/0032-0633(95)00107-7; Park et al. (2021),
doi:10.3847/1538-3881/abd414.

### 2.3 `nasa-svs-cgi-moon-kit` — global color map (visualization only)

| Field | Value |
| --- | --- |
| Provider | NASA Scientific Visualization Studio, SVS 4720 (<https://svs.gsfc.nasa.gov/4720>) |
| File | `lroc_color_poles_4k.tif` — 4096 × 2048, 8-bit RGB, 13 095 388 B, `918649a7f8ed2f1329b2cd95bb0d25483befdcb60ae1a66db681a637cc21344f` |
| Source data | LROC WAC Hapke-normalized mosaic (70° N – 70° S); poles filled with LOLA LDAM (per SVS) |
| Projection | SVS states the maps are "centered on 0° longitude" and names neither the projection nor a numeric range. LUNARIS **assumes** simple cylindrical (equirectangular), −180°…+180°, north up — recorded as an assumption in the web texture manifest |
| Credit | "NASA's Scientific Visualization Studio" |
| Use | **Visualization only — never an analysis input** |

`uv run lunaris-data build-web-texture` converts it to `apps/web/public/textures/moon/moon-color.jpg`
plus a `manifest.json` with full provenance; the web client switches from the labeled
procedural placeholder to this texture automatically. A newer 16-bit map
(`lroc_color_16bit_srgb_4k.tif`, 61 891 324 B, SHA-256
`9731fa8af425b6c2f88f277ecca82bf8c603f3743894f64ed7b25c5bfefa22ff`) exists; M01 keeps the
8-bit map because the builder accepts 8-bit input only. SVS displacement maps (float TIFFs
in km relative to 1737.4 km; uint16 TIFFs in half-metres, offset +20000, relative to
1727.4 km) are not used — terrain comes from LOLA products directly.

## 3. Candidate products for Milestone 02 (site-scale terrain)

Identified during the 2026-11-04 verification. `docs/DECISIONS.md` D3 selects the 240 m
GDR (§2.1) for horizon masks and the PGDA 20 m DEM — read as windows via GDAL `/vsicurl/`,
not downloaded whole — for slope and hazards, with PGDA 5 m per-site DEMs where they cover
a site. Manifests will be added in M02; the manifest model must gain a "remote windowed
source" kind for this. All are south polar stereographic, `MOON_ME` (DE421).

| Product | Source | Resolution / coverage | Notes |
| --- | --- | --- | --- |
| `LDEM_80S_20M` | PDS LOLA GDR (polar) | 20 m, 80° S – 90° S | int16 `.img`, float `.img`, `.jp2` |
| `LDEM_85S_10M`, `LDEM_875S_10M` | PDS LOLA GDR (polar) | 10 m | as above |
| `LDEM_875S_5M` | PDS LOLA GDR (polar) | 5 m, 87.5° S – 90° S | as above |
| PGDA product 81 `ldem_87s_5mpp.tif` | NASA GSFC PGDA | 5 m, 87° S – 90° S (3 465 285 714 B) | Barker et al. (2021), doi:10.1016/j.pss.2020.105119 |
| PGDA product 90 `LDEM_80S_20MPP_ADJ.TIF` (2 696 082 051 B), `LDEM_83S_10MPP_ADJ.TIF` (5 116 709 568 B) | NASA GSFC PGDA | 20 m / 10 m | BigTIFF, float32, 512² deflate tiles, `Accept-Ranges: bytes` (D3). Barker et al. (2023), doi:10.3847/PSJ/acf3e1; data doi:10.60903/gsfcpgda-lola-spole |
| PGDA product 78 | NASA GSFC PGDA | 5 m per-site DEMs (27 sites; e.g. Haworth, 142 123 767 B) | float32, uncompressed (D3) |
| PGDA product 104 | Zenodo, doi:10.5281/zenodo.17954508 | 5 m shape-from-shading DEMs | Photoclinometry-derived: label as a distinct product class |

Selection criteria for M02: coverage of the analysis region, resolution vs. slope
baseline, file size (the 5 m PGDA mosaic is 3.5 GB), processing lineage, and citation
requirements.

## 4. Validation references

| File | Content | Status |
| --- | --- | --- |
| `data/fixtures/validation/horizons-sun-s89p5-e0-2026-11-04.json` | JPL Horizons (API 1.2, DE441, MEAN_ME, 1737.4 km sphere) apparent Sun az/el from 89.5° S, 0° E, h = 0: 25 hourly samples, 2026-11-04 00:00 → 11-05 00:00 UTC; exact request URL and verbatim `$$SOE…$$EOE` block | Regression fixture (T-21); tolerance 0.01″, `docs/SCIENCE.md` §5.2 |
| `data/fixtures/validation/horizons-earth-s89p5-e0-2026-11-04.json` | Same query for the Earth (`COMMAND='399'`) | Regression fixture (T-21) |

Both were requested on 2026-11-04 directly from `ssd.jpl.nasa.gov`, which is reachable from
the development environment. They replace a two-sample Sun fixture relayed second-hand,
which wrongly stated that NASA/JPL hosts were blocked.

## 5. Future sources (not yet registered)

- **NASA Moon Trek** (<https://trek.nasa.gov/moon/>) — tiled imagery and derived layers
  for map overlays.
- **LRO LROC** NAC/WAC products — high-resolution imagery for site inspection.
- **JPL Horizons API** — automated validation references (M03).
- **NASA LRO data products** (<https://science.nasa.gov/mission/lro/data-products/>) —
  e.g. Diviner thermal data for future environmental layers.

## 6. Adding a dataset

1. Create `packages/data/src/lunaris_data/manifests/<id>.json` (schema:
   `lunaris_data.manifest.DatasetManifest`; the file name must equal the id).
2. Start with `"verification": {"status": "unverified", "note": "…"}`.
3. Acquire it from a machine with archive access; confirm sizes and SHA-256 against the
   acquisition record (and archive checksums where published).
4. Pin `sha256` and `size_bytes`, set `"status": "verified"` with `checked_on`, describe how
   it was verified in `note`.
5. `uv run pytest tests/data` validates every manifest.

## 7. Acquisition from restricted networks

`lunaris-data` uses `httpx` with the system's proxy settings and CA store. If an archive
host is blocked by a network policy (this happened for part of the Milestone 01 build
session, before the policy was widened), acquisition fails with the HTTP/transport error
and a pointer to the manifest; nothing partial is recorded.
