"""Build ``published-illumination.json`` from the published LOLA illumination maps (T-25).

Reads the PDS LOLA "EXTRAS" average-visibility maps of Mazarico et al. (2011) at the
reference points of the south-pole candidate-site catalogue and records each value with
its pixel, local 3 × 3 spread, product checksum and the product's own definitions.
Nothing is typed in by hand: every number comes from the files given on the command line.

Usage (files from https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/
extras/illumination/release_2014/img/)::

    uv run python data/fixtures/validation/build_published_illumination.py \\
        avgvisib_65s_240m.img avgvisib_65s_240m_earth.img > published-illumination.json
"""

from __future__ import annotations

import hashlib
import json
import sys
from importlib import resources
from pathlib import Path

import numpy as np

from lunaris_science.terrain.polar_stereographic import PolarStereographicGrid

BASE_URL = (
    "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/"
    "illumination/release_2014/img/"
)
# From the PDS3 labels (avgvisib_65s_240m.lbl, avgvisib_65s_240m_earth.lbl).
LINES = SAMPLES = 6420
OFFSET_PX = 3209.5
MAP_SCALE_M = 240.0
SCALING_FACTOR = 0.00004
PERIOD = {"start_utc": "2001-01-01", "end_utc": "2018-08-08", "step": "1 hour"}
MAZARICO_2011 = (
    "Mazarico, E., Neumann, G. A., Smith, D. E., Zuber, M. T., & Torrence, M. H. (2011). "
    "Illumination conditions of the lunar polar regions using LOLA topography. Icarus, "
    "211(2), 1066–1081. doi:10.1016/j.icarus.2010.10.030"
)
PRODUCTS = {
    "sun": {
        "product_id": "AVGVISIB_65S_240M",
        "quantity": "illuminated_fraction",
        "definition_verbatim": (
            "Visibility varies between 0, when the sun is not visible, and 1, when any "
            "part of it is. A given data value is obtained from time averaging of "
            "computational modeling results performed every hour over ~18.6 years (2001 "
            "JAN 01 to 2018 AUG 08) and indicates the fraction of time the Sun is visible "
            "from this location. The Sun is considered an extended source."
        ),
        "label_file": "avgvisib_65s_240m.lbl",
    },
    "earth": {
        "product_id": "AVGVISIB_65S_240M_EARTH",
        "quantity": "earth_visible_fraction",
        "definition_verbatim": (
            "Visibility varies between 0, when the Earth is not visible, and 1, when any "
            "part of it is. A given data value is obtained from time averaging of "
            "computational modeling results performed every hour over ~18.6 years (2001 "
            "JAN 01 to 2018 AUG 08) and indicates the fraction of time the Earth is "
            "visible from this location. The Earth is considered an extended source."
        ),
        "label_file": "avgvisib_65s_240m_earth.lbl",
    },
}


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _sites() -> list[dict[str, object]]:
    catalog = resources.files("lunaris_data.catalogs") / "south-pole-candidate-sites.json"
    payload = json.loads(catalog.read_text(encoding="utf-8"))
    return list(payload["sites"])


def main(sun_img: str, earth_img: str) -> dict[str, object]:
    grid = PolarStereographicGrid(LINES, SAMPLES, OFFSET_PX, OFFSET_PX, MAP_SCALE_M)
    maps = {}
    for key, path in (("sun", Path(sun_img)), ("earth", Path(earth_img))):
        data = np.fromfile(path, dtype="<i2").reshape(LINES, SAMPLES).astype(np.float64)
        maps[key] = (data * SCALING_FACTOR, _sha256(path), path.name)

    entries = []
    for site in _sites():
        point = site["reference_point"]
        if not isinstance(point, dict):
            raise TypeError(f"site {site['id']} has no reference_point")
        line_f, sample_f = grid.latlon_to_pixel(point["latitude_deg"], point["longitude_deg"])
        line, sample = int(np.rint(line_f)), int(np.rint(sample_f))
        for key, (values, sha, name) in maps.items():
            window = values[line - 1 : line + 2, sample - 1 : sample + 2]
            product = PRODUCTS[key]
            entries.append(
                {
                    "id": f"mazarico2011-{product['product_id'].lower()}-{site['id']}",
                    "site_id": site["id"],
                    "site_name": site["name"],
                    "body": key,
                    "quantity": product["quantity"],
                    "value": round(float(values[line, sample]), 5),
                    "local_3x3": {
                        "min": round(float(window.min()), 5),
                        "max": round(float(window.max()), 5),
                        "mean": round(float(window.mean()), 5),
                    },
                    "pixel": {"line": line, "sample": sample, "zero_based": True},
                    "product_id": product["product_id"],
                    "product_url": BASE_URL + name,
                    "product_sha256": sha,
                }
            )
    return {
        "schema_version": 1,
        "id": "published-illumination",
        "purpose": (
            "Reference values for T-25: published average solar illumination and Earth "
            "visibility at the candidate-site reference points, read from the products "
            "themselves (no value typed from memory)."
        ),
        "evidence_kind": "derived_product",
        "built_by": "data/fixtures/validation/build_published_illumination.py",
        "sources": {
            "mazarico2011_maps": {
                "citation": MAZARICO_2011,
                "product_page": "https://pgda.gsfc.nasa.gov/products/69",
                "archive": BASE_URL,
                "period": PERIOD,
                "resolution_m": MAP_SCALE_M,
                "projection": (
                    "South polar stereographic, sphere 1737.4 km, MEAN EARTH/POLAR AXIS OF "
                    "DE421, line/sample projection offsets 3209.5 px (labels)."
                ),
                "dem": (
                    "LOLA polar topography at 240 m/px. The labels do not name the DEM "
                    "version; LDEM_75S_240M uses the same grid spacing and projection."
                ),
                "method": (
                    "Labels: hourly modelling over ~18.6 years; Sun and Earth treated as "
                    "extended sources; visible means any part of the disk. Observer height "
                    "and horizon range are not stated in the labels; method details are in "
                    "Mazarico et al. (2011), which is not reachable from this environment."
                ),
                "products": {k: dict(v) for k, v in PRODUCTS.items()},
                "label_quirk": (
                    "Both south-pole labels state CENTER_LATITUDE = 90 <deg>. The data are "
                    "south polar; orientation was checked against LDEM_75S_240M (height "
                    "minus its 21-pixel mean): correlation +0.35 as labelled with the LOLA "
                    "GDR convention, |r| < 0.02 for every flip, transpose and 180° rotation."
                ),
                "sampling": (
                    "Value of the pixel containing the catalogue reference point (the centre "
                    "of the site's PGDA 5 m tile, not a selected landing point), plus the "
                    "3 × 3 neighbourhood (720 m) to show local variability."
                ),
            },
            "barker2021_site_statement": {
                "citation": (
                    "Barker, M. K., et al. (2021). Improved LOLA Elevation Maps for South "
                    "Pole Landing Sites: Error Estimates and Their Impact on Illumination "
                    "Conditions. Planetary and Space Science, 203, 105119. "
                    "doi:10.1016/j.pss.2020.105119"
                ),
                "read_from": "https://pgda.gsfc.nasa.gov/products/78",
                "quote_verbatim": (
                    "Between Jan. 1, 2024 and Jan. 1, 2026, Site 1 has the most area with "
                    "average illumination > 70% at 1 m above the surface and RoIs 4 - 6 at "
                    "this site generally have the most favorable illumination conditions "
                    "even considering their uncertainties. At 5 m above the surface, the "
                    "effect of LDEM uncertainties on illumination conditions are "
                    "significantly reduced, and Site 1 has longer continuous illumination "
                    "periods than the other sites."
                ),
                "status": "qualitative",
                "note": (
                    "A ranking over regions of interest, not a point value: usable as a "
                    "consistency check (Site01 > 70% somewhere within its RoIs at 1 m, "
                    "2024-01-01 → 2026-01-01, 5 m DEM), not as a numeric target."
                ),
            },
            "paper_tables": {
                "status": "unavailable",
                "reason": (
                    "doi.org, the publishers' sites and NTRS are not reachable from the "
                    "development environment (checked 2026-11-05). Point values from the "
                    "tables of Mazarico et al. (2011), Gläser et al. (2014) and Barker et al. "
                    "(2021) are therefore not recorded; none is quoted from memory."
                ),
            },
        },
        "entries": entries,
    }


if __name__ == "__main__":
    json.dump(main(sys.argv[1], sys.argv[2]), sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write("\n")
