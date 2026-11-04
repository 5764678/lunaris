"""SYNTHETIC LDEM-style PDS3 products for tests (no real data).

``write_planar_ldem`` writes a label + IMG whose heights form an exact plane in the
map: DN = 2·line + 3·sample + dn0, so HEIGHT = 0.5·DN is linear in (x, y) and bilinear
interpolation reproduces it exactly.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

import numpy as np

LABEL_TEMPLATE = """PDS_VERSION_ID = "PDS3"
OBJECT = UNCOMPRESSED_FILE
^IMAGE = "{image}"
  OBJECT = IMAGE
    LINES = {n}
    LINE_SAMPLES = {n}
    DERIVED_MINIMUM = {dn_min}
    DERIVED_MAXIMUM = {dn_max}
    SAMPLE_TYPE = LSB_INTEGER
    SAMPLE_BITS = 16
    UNIT = METER
    SCALING_FACTOR = 0.5
    OFFSET = 1737400.
    {missing}
  END_OBJECT = IMAGE
END_OBJECT = UNCOMPRESSED_FILE
OBJECT = IMAGE_MAP_PROJECTION
 MAP_PROJECTION_TYPE = "POLAR STEREOGRAPHIC"
 KEYWORD_LATITUDE_TYPE = "PLANETOCENTRIC"
 A_AXIS_RADIUS = 1737.4 <km>
 B_AXIS_RADIUS = 1737.4 <km>
 C_AXIS_RADIUS = 1737.4 <km>
 POSITIVE_LONGITUDE_DIRECTION = "EAST"
 CENTER_LATITUDE = -90 <deg>
 CENTER_LONGITUDE = 0 <deg>
 LINE_FIRST_PIXEL = 1
 LINE_LAST_PIXEL = {n}
 SAMPLE_FIRST_PIXEL = 1
 SAMPLE_LAST_PIXEL = {n}
 MAP_PROJECTION_ROTATION = 0.0
 MAP_SCALE = {scale} <m/pix>
 LINE_PROJECTION_OFFSET = {offset} <pix>
 SAMPLE_PROJECTION_OFFSET = {offset} <pix>
 COORDINATE_SYSTEM_NAME = "MEAN EARTH/POLAR AXIS OF DE421"
END_OBJECT = IMAGE_MAP_PROJECTION
END
"""
MISSING = -32768
DN0 = -300


def planar_dn(n: int) -> np.ndarray:
    line, sample = np.mgrid[0:n, 0:n]
    return (2 * line + 3 * sample + DN0).astype("<i2")


def planar_height_at_map(x_m: float, y_m: float, *, n: int, scale_m: float) -> float:
    """Exact synthetic height (m) at map coordinates."""
    offset = (n - 1) / 2
    line = offset - y_m / scale_m
    sample = offset + x_m / scale_m
    return 0.5 * (2 * line + 3 * sample + DN0)


def write_planar_ldem(
    directory: Path,
    *,
    n: int = 64,
    scale_m: float = 8000.0,
    label_name: str = "LDEM_75S_240M.LBL",
    image_name: str = "LDEM_75S_240M.IMG",
    holes: tuple[tuple[int, int], ...] = (),
) -> dict[str, tuple[int, str]]:
    """Write the product; return {file name: (size, sha256)}."""
    directory.mkdir(parents=True, exist_ok=True)
    dn = planar_dn(n)
    for line, sample in holes:
        dn[line, sample] = MISSING
    valid = dn[dn != MISSING]
    label = LABEL_TEMPLATE.format(
        image=image_name,
        n=n,
        dn_min=int(valid.min()),
        dn_max=int(valid.max()),
        missing=f"MISSING_CONSTANT = {MISSING}" if holes else "",
        scale=scale_m,
        offset=(n - 1) / 2,
    ).encode("ascii")
    image = dn.tobytes()
    (directory / label_name).write_bytes(label)
    (directory / image_name).write_bytes(image)
    return {
        label_name: (len(label), hashlib.sha256(label).hexdigest()),
        image_name: (len(image), hashlib.sha256(image).hexdigest()),
    }
