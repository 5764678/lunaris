"""Capture the LDEM_75S_240M axis-orientation fixture (run by hand, not by pytest).

For each reference point, this records:

* the LDEM_75S_240M pixel that LUNARIS's grid convention assigns to the point, and the
  DN there and at the pixels the two alternative conventions would pick (sample axis
  mirrored, as the DSMAP_POLAR.CAT forward equation implies; line axis flipped);
* the mean height of the co-located 240 m footprint (12 × 12 pixels) in the PGDA
  ``LDEM_80S_20MPP_ADJ.TIF`` GeoTIFF, whose georeferencing (GeoTIFF CRS + geotransform)
  is independent of the PDS3 label.

Usage (needs the acquired LDEM and network access to pgda.gsfc.nasa.gov)::

    uv run python tests/fixtures/terrain/capture_ldem_orientation_fixture.py \
        data/raw/lola-ldem-75s-240m/LDEM_75S_240M.IMG \
        tests/fixtures/terrain/ldem-75s-240m-orientation.json
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import rasterio
from rasterio.windows import Window

from lunaris_science.terrain.polar_stereographic import PolarStereographicGrid

PGDA_URL = "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF"
POINTS = [
    (-89.67, 129.2),
    (-88.0, 300.0),
    (-86.0, 250.0),
    (-85.0, 40.0),
    (-84.0, 200.0),
    (-82.0, 100.0),
    (-81.0, 330.0),
    (-87.0, 160.0),
]
GDAL_ENV = {
    "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
    "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".TIF",
    "GDAL_HTTP_MULTIRANGE": "SINGLE_GET",
    "GDAL_HTTP_MAX_RETRY": "6",
    "GDAL_HTTP_RETRY_DELAY": "1",
    "GDAL_HTTP_RETRY_CODES": "403,429,500,502,503,504",
}


def main(img_path: Path, out_path: Path) -> None:
    raw = img_path.read_bytes()
    dn = np.frombuffer(raw, dtype="<i2").reshape(3812, 3812)
    grid = PolarStereographicGrid(3812, 3812, 1905.5, 1905.5, 240.0)
    records = []
    with rasterio.Env(**GDAL_ENV), rasterio.open(f"/vsicurl/{PGDA_URL}") as pgda:
        a = pgda.transform
        for lat, lon in POINTS:
            line_f, sample_f = grid.latlon_to_pixel(lat, lon)
            line, sample = round(float(line_f)), round(float(sample_f))
            mirrored_sample = 3811 - sample
            flipped_line = 3811 - line
            x_c, y_c = grid.pixel_to_map(line, sample)
            col0 = round((float(x_c) - 120.0 - a.c) / a.a)
            row0 = round((float(y_c) + 120.0 - a.f) / a.e)
            block = pgda.read(1, window=Window(col0, row0, 12, 12))
            records.append(
                {
                    "latitude_deg": lat,
                    "longitude_deg": lon,
                    "ldem_line": line,
                    "ldem_sample": sample,
                    "ldem_dn": int(dn[line, sample]),
                    "ldem_mirrored_sample": mirrored_sample,
                    "ldem_mirrored_dn": int(dn[line, mirrored_sample]),
                    "ldem_flipped_line": flipped_line,
                    "ldem_flipped_dn": int(dn[flipped_line, sample]),
                    "pgda_window_col_row": [col0, row0, 12, 12],
                    "pgda_mean_height_m": round(float(np.nanmean(block)), 3),
                }
            )
        crs_wkt = pgda.crs.to_wkt()
        transform = list(a)[:6]
    fixture = {
        "description": (
            "Pins the LDEM_75S_240M pixel-axis orientation (0-based line/sample, "
            "x = (sample - 1905.5)*240, y = -(line - 1905.5)*240, x = rho sin(lon), "
            "y = rho cos(lon)) against an independently georeferenced PGDA GeoTIFF."
        ),
        "captured_utc": dt.datetime.now(dt.UTC).isoformat(timespec="seconds"),
        "ldem": {
            "dataset_id": "lola-ldem-75s-240m",
            "file": "LDEM_75S_240M.IMG",
            "sha256": hashlib.sha256(raw).hexdigest(),
            "height_rule": "HEIGHT = DN * 0.5 m above the 1737400 m sphere",
        },
        "pgda": {
            "url": PGDA_URL,
            "crs_wkt": crs_wkt,
            "geotransform_affine": transform,
            "footprint": "mean of the 12 x 12 20 m pixels covering the 240 m LDEM pixel",
            "citation": "Barker et al. (2023), PSJ 4, 183, doi:10.3847/PSJ/acf3e1",
        },
        "points": records,
    }
    out_path.write_text(json.dumps(fixture, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
