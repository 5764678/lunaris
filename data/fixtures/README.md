# data/fixtures — committed fixtures

Only small files belong here, and each must document what it is:

- `validation/` — **reference values from authoritative external sources** used to validate
  LUNARIS calculations (for example JPL Horizons ephemerides). Each file records its source,
  retrieval date, query parameters and known limitations. These are real reference values,
  never invented ones.
- Synthetic test data is generated inside the tests themselves (see `tests/data/`) and is
  always labeled synthetic. Synthetic data is never presented as lunar data.
