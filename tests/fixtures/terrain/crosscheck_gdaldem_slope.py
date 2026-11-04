"""Cross-check LUNARIS Horn slope against ``gdaldem slope`` on a real PGDA 20 m window.

Run by hand (needs network access to pgda.gsfc.nasa.gov and ``gdaldem`` on PATH)::

    uv run python tests/fixtures/terrain/crosscheck_gdaldem_slope.py -89.45 222.69 1000

Prints the agreement of the uncorrected operator (projected spacing, as gdaldem uses)
and of the scale-corrected operator LUNARIS reports, plus the site analysis.
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import Affine

from lunaris_data.registry import DatasetRegistry
from lunaris_data.remote.window import read_window, remote_source
from lunaris_science.terrain.analysis import HazardThresholds, analyze_site, horn_slope_deg


def main(lat: float, lon: float, side: int) -> None:
    source = remote_source(DatasetRegistry.load_builtin().get("pgda-lola-20mpp-80s"))
    window = read_window(source, latitude_deg=lat, longitude_deg=lon, side_px=side)
    dem, p = window.dem, window.provenance
    a, c, f = p.geotransform_a_c_f
    col0, row0, width, height = p.window_col_row_width_height
    with tempfile.TemporaryDirectory() as tmp:
        src, dst = Path(tmp) / "w.tif", Path(tmp) / "s.tif"
        with rasterio.open(
            src,
            "w",
            driver="GTiff",
            width=width,
            height=height,
            count=1,
            dtype="float32",
            transform=Affine(a, 0, c + a * col0, 0, -a, f - a * row0),
            nodata=np.nan,
        ) as out:
            out.write(dem.heights_m, 1)
        subprocess.run(["gdaldem", "slope", "-q", str(src), str(dst)], check=True)  # noqa: S607
        with rasterio.open(dst) as ds:
            reference = ds.read(1, masked=True).filled(np.nan).astype(np.float64)
    inner = (slice(1, -1), slice(1, -1))
    ours_raw = horn_slope_deg(dem, scale_corrected=False)[inner]
    ours = horn_slope_deg(dem)[inner]
    ref = reference[inner]
    ok = np.isfinite(ref) & np.isfinite(ours)
    print(
        f"window {p.window_col_row_width_height}, {p.bytes_requested} B requested, "
        f"{p.http_retries} retries, {ok.sum()} compared cells"
    )
    print(f"uncorrected vs gdaldem: max |d| = {np.max(np.abs(ours_raw[ok] - ref[ok])):.2e} deg")
    d = ours[ok] - ref[ok]
    print(f"scale-corrected vs gdaldem: mean d = {d.mean():.2e}, max |d| = {np.abs(d).max():.2e}")
    print(
        f"slope stats (corrected): mean {ours[ok].mean():.2f}, "
        f"p95 {np.percentile(ours[ok], 95):.2f}, max {ours[ok].max():.2f} deg"
    )
    print(
        analyze_site(
            dem, lat, lon, footprint_radius_m=100.0, thresholds=HazardThresholds(10.0, 1.0)
        )
    )


if __name__ == "__main__":
    main(float(sys.argv[1]), float(sys.argv[2]), int(sys.argv[3]))
