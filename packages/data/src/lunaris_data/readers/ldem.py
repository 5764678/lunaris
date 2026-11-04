"""Reader for LOLA GDR polar stereographic DEMs in PDS3 form (for example LDEM_75S_240M).

Everything that shapes the numbers is read from the label and checked, never assumed:
image size, sample type, scaling factor, offset (reference-sphere radius), projection
type, centre, axis radii, offsets, map scale, latitude type, longitude direction and
coordinate system. A product whose projection or frame does not match what LUNARIS
implements is refused with :class:`LdemFormatError`.

Heights are returned as float32 metres above the sphere (HEIGHT = DN × SCALING_FACTOR;
OFFSET is the sphere radius, not a height offset: ``docs/SCIENCE.md`` §5.1). A label
``MISSING_CONSTANT``, if present, becomes NaN; LDEM_75S_240M declares none.
"""

from __future__ import annotations

import hashlib
import math
from pathlib import Path

import numpy as np

from lunaris_data.pds3 import Pds3LabelError, Pds3Object, read_pds3_label, resolve_pointer
from lunaris_science.terrain.dem import PolarDem
from lunaris_science.terrain.polar_stereographic import (
    PolarStereographicGrid,
    SouthPolarStereographic,
)

EXPECTED_FRAME = "MEAN EARTH/POLAR AXIS OF DE421"
"""LOLA's name for the frame LUNARIS calls ``MOON_ME`` (``docs/DECISIONS.md`` D2)."""

_SAMPLE_TYPES = {("LSB_INTEGER", 16): "<i2", ("MSB_INTEGER", 16): ">i2"}
_KM = "km"
_M_PER_KM = 1000.0
_TOLERANCE = 1e-9


class LdemFormatError(ValueError):
    """Raised when a product is not a LOLA south polar stereographic DEM LUNARIS can read."""


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise LdemFormatError(message)


def _radius_m(projection: Pds3Object, key: str) -> float:
    quantity = projection.quantity(key)
    _require(quantity.unit.lower() == _KM, f"{key} unit must be km, got {quantity.unit!r}")
    return quantity.value * _M_PER_KM


def _check_projection(projection: Pds3Object) -> tuple[float, PolarStereographicGrid]:
    _require(
        projection.text("MAP_PROJECTION_TYPE") == "POLAR STEREOGRAPHIC",
        "MAP_PROJECTION_TYPE must be POLAR STEREOGRAPHIC",
    )
    _require(projection.number("CENTER_LATITUDE") == -90.0, "CENTER_LATITUDE must be -90")  # noqa: PLR2004
    _require(projection.number("CENTER_LONGITUDE") == 0.0, "CENTER_LONGITUDE must be 0")
    _require(
        projection.text("KEYWORD_LATITUDE_TYPE") == "PLANETOCENTRIC",
        "KEYWORD_LATITUDE_TYPE must be PLANETOCENTRIC",
    )
    _require(
        projection.text("POSITIVE_LONGITUDE_DIRECTION") == "EAST",
        "POSITIVE_LONGITUDE_DIRECTION must be EAST",
    )
    _require(
        projection.text("COORDINATE_SYSTEM_NAME") == EXPECTED_FRAME,
        f"COORDINATE_SYSTEM_NAME must be {EXPECTED_FRAME!r}",
    )
    _require(
        projection.number("MAP_PROJECTION_ROTATION") == 0.0, "MAP_PROJECTION_ROTATION must be 0"
    )
    radii = [_radius_m(projection, k) for k in ("A_AXIS_RADIUS", "B_AXIS_RADIUS", "C_AXIS_RADIUS")]
    _require(radii[0] == radii[1] == radii[2], "projection body must be a sphere (A = B = C)")
    scale = projection.quantity("MAP_SCALE")
    _require(
        scale.unit.lower() in ("m/pix", "meters/pixel", "m/pixel"), f"MAP_SCALE unit {scale.unit!r}"
    )
    lines = int(projection.number("LINE_LAST_PIXEL") - projection.number("LINE_FIRST_PIXEL") + 1)
    samples = int(
        projection.number("SAMPLE_LAST_PIXEL") - projection.number("SAMPLE_FIRST_PIXEL") + 1
    )
    grid = PolarStereographicGrid(
        lines=lines,
        samples=samples,
        line_projection_offset_px=projection.number("LINE_PROJECTION_OFFSET"),
        sample_projection_offset_px=projection.number("SAMPLE_PROJECTION_OFFSET"),
        map_scale_m=scale.value,
        projection=SouthPolarStereographic(radii[0]),
    )
    return radii[0], grid


def read_ldem_polar(label_path: Path, dataset_id: str) -> PolarDem:
    """Read a LOLA GDR south polar stereographic DEM from its PDS3 label.

    Args:
        label_path: path of the ``.LBL`` file; the ``^IMAGE`` pointer is resolved next to
            it, case-insensitively (the PDS serves lower-case names).
        dataset_id: manifest id recorded in the result's provenance.

    Raises:
        LdemFormatError: unsupported or inconsistent product.
        Pds3LabelError: unreadable label.
    """
    label = read_pds3_label(label_path)
    try:
        container = label.object("UNCOMPRESSED_FILE")
    except Pds3LabelError:
        container = label
    pointer = container.get("^IMAGE")
    _require(
        isinstance(pointer, str), "^IMAGE must name a detached file (byte offsets unsupported)"
    )
    image_path = resolve_pointer(label_path, str(pointer))

    image = label.object("IMAGE")
    lines, samples = int(image.number("LINES")), int(image.number("LINE_SAMPLES"))
    dtype_code = _SAMPLE_TYPES.get((image.text("SAMPLE_TYPE"), int(image.number("SAMPLE_BITS"))))
    _require(dtype_code is not None, "SAMPLE_TYPE/SAMPLE_BITS must be 16-bit integers")
    _require(image.text("UNIT").upper() in ("METER", "METERS", "M"), "IMAGE UNIT must be METER")
    _require(int(image.keywords.get("BANDS", 1)) == 1, "only single-band images are supported")  # type: ignore[arg-type]
    scaling = image.number("SCALING_FACTOR")
    offset_radius = image.number("OFFSET")

    radius, grid = _check_projection(label.object("IMAGE_MAP_PROJECTION"))
    _require(
        (grid.lines, grid.samples) == (lines, samples),
        "projection pixel range differs from image size",
    )
    _require(
        math.isclose(offset_radius, radius, rel_tol=0.0, abs_tol=_TOLERANCE),
        f"OFFSET ({offset_radius} m) must equal the projection sphere radius ({radius} m)",
    )

    raw = image_path.read_bytes()
    expected_bytes = lines * samples * 2
    _require(
        len(raw) == expected_bytes,
        f"{image_path.name} has {len(raw)} B, label implies {expected_bytes} B",
    )
    digest = hashlib.sha256(raw).hexdigest()
    dn = np.frombuffer(raw, dtype=np.dtype(dtype_code)).reshape(lines, samples)

    valid = np.ones(dn.shape, dtype=bool)
    if "MISSING_CONSTANT" in image.keywords:
        valid = dn != int(image.number("MISSING_CONSTANT"))
    if "DERIVED_MINIMUM" in image.keywords and "DERIVED_MAXIMUM" in image.keywords:
        lo, hi = image.number("DERIVED_MINIMUM"), image.number("DERIVED_MAXIMUM")
        values = dn[valid]
        _require(
            values.size == 0 or (values.min() >= lo and values.max() <= hi),
            f"DN range outside the label's DERIVED_MINIMUM/MAXIMUM [{lo}, {hi}]",
        )

    heights = (dn.astype(np.float32) * np.float32(scaling)).astype(np.float32)
    heights[~valid] = np.nan
    return PolarDem(
        heights_m=heights,
        grid=grid,
        reference_radius_m=radius,
        dataset_id=dataset_id,
        file_name=image_path.name,
        sha256=digest,
        frame=EXPECTED_FRAME,
    )


__all__ = ["EXPECTED_FRAME", "LdemFormatError", "read_ldem_polar"]
