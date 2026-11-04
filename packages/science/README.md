# lunaris-science

The scientific core of LUNARIS. Pure, deterministic, unit-explicit code.

**Rules for this package** (see `docs/ARCHITECTURE.md`):

- No web framework imports, no network access, no implicit file I/O. Data loading
  lives in `lunaris-data`; HTTP lives in `lunaris-api`.
- Every public function documents its units and reference frame.
- Every result that leaves this package is accompanied by an
  `lunaris_science.provenance.Evidence` record stating whether it is an
  observation, a derived product, a model output, a calculation, an assumption,
  or a placeholder.

## Contents (Milestone 01)

| Module | Status | Purpose |
| --- | --- | --- |
| `constants` | implemented | Reference constants with units and citations |
| `frames` | implemented | Body-fixed lunar frame identifiers (`MOON_ME`, `MOON_PA`) |
| `coordinates` | implemented | Selenographic coordinate validation, normalization, spherical ↔ Cartesian |
| `provenance` | implemented | Evidence / source-reference model |
| `runtime` | implemented | Scientific toolchain version report (reproducibility) |
| `horizon_mask` | implemented (T-10) | `HorizonMask` type, contract C1 (computation: T-15) |
| `terrain` | in progress (M02) | `polar_stereographic` implemented (T-10); elevation, slope, roughness from LOLA DEMs planned |
| `geometry` | planned (M03) | Sun/Earth positions and local az/el via SPICE |
| `illumination` | planned (M04) | Geometric and terrain-aware illumination |
| `visibility` | planned (M04) | Geometric and terrain-aware Earth line of sight |
| `energy` | planned (future) | Solar energy estimation |
| `scoring` | planned (M05) | Constraints, scoring and site comparison |

Planned modules contain only a docstring describing their responsibility. They
intentionally expose no functions until they are implemented and validated.
