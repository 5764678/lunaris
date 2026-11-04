"""PDS3 label parser and LDEM polar reader (task T-11)."""

from __future__ import annotations

import os
from pathlib import Path

import numpy as np
import pytest

from lunaris_data.pds3 import Pds3LabelError, Pds3Quantity, parse_pds3_label, resolve_pointer
from lunaris_data.readers.ldem import LdemFormatError, read_ldem_polar
from lunaris_science.terrain.dem import DemError, PolarDem
from lunaris_science.terrain.polar_stereographic import PolarStereographicGrid

REAL_LABEL = (
    Path(os.environ.get("LUNARIS_DATA_DIR", "data")) / "raw/lola-ldem-75s-240m/LDEM_75S_240M.LBL"
)
N = 8
LABEL = """PDS_VERSION_ID = "PDS3"
MISSION_PHASE_NAME = {"COMMISSIONING","NOMINAL
                      MISSION"}
DESCRIPTION = "multi
   line   text"
OBJECT = UNCOMPRESSED_FILE
^IMAGE = "TINY.IMG"
  OBJECT = IMAGE
    LINES = 8
    LINE_SAMPLES = 8
    DERIVED_MINIMUM = -100
    DERIVED_MAXIMUM = 100
    SAMPLE_TYPE = LSB_INTEGER
    SAMPLE_BITS = 16
    UNIT = METER
    SCALING_FACTOR = 0.5
    OFFSET = 1737400.
    {extra_image}
/* a comment = with equals */
  END_OBJECT = IMAGE
END_OBJECT = UNCOMPRESSED_FILE
OBJECT = IMAGE_MAP_PROJECTION
 MAP_PROJECTION_TYPE = "{ptype}"
 KEYWORD_LATITUDE_TYPE = "PLANETOCENTRIC"
 A_AXIS_RADIUS = 1737.4 <km>
 B_AXIS_RADIUS = 1737.4 <km>
 C_AXIS_RADIUS = 1737.4 <km>
 FIRST_STANDARD_PARALLEL = 'N/A'
 POSITIVE_LONGITUDE_DIRECTION = "EAST"
 CENTER_LATITUDE = {clat} <deg>
 CENTER_LONGITUDE = 0 <deg>
 LINE_FIRST_PIXEL = 1
 LINE_LAST_PIXEL = 8
 SAMPLE_FIRST_PIXEL = 1
 SAMPLE_LAST_PIXEL = 8
 MAP_PROJECTION_ROTATION = 0.0
 MAP_SCALE = 240 <m/pix>
 LINE_PROJECTION_OFFSET = 3.5 <pix>
 SAMPLE_PROJECTION_OFFSET = 3.5 <pix>
 COORDINATE_SYSTEM_NAME = "{frame}"
END_OBJECT = IMAGE_MAP_PROJECTION
END
"""


def _write(
    tmp_path: Path,
    *,
    dn: np.ndarray | None = None,
    image_name: str = "TINY.IMG",
    **fmt: str,
) -> Path:
    values = {
        "ptype": "POLAR STEREOGRAPHIC",
        "clat": "-90",
        "frame": "MEAN EARTH/POLAR AXIS OF DE421",
        "extra_image": "",
    }
    values.update(fmt)
    label = tmp_path / "TINY.LBL"
    text = LABEL
    for key, value in values.items():
        text = text.replace("{" + key + "}", value)
    label.write_text(text, encoding="ascii")
    if dn is None:
        dn = np.arange(N * N, dtype="<i2").reshape(N, N) - 32
    (tmp_path / image_name).write_bytes(np.asarray(dn, dtype="<i2").tobytes())
    return label


def test_parser_values_units_sequences_and_comments(tmp_path: Path) -> None:
    root = parse_pds3_label(_write(tmp_path).read_text(encoding="ascii"))
    assert root.get("MISSION_PHASE_NAME") == ("COMMISSIONING", "NOMINAL MISSION")
    assert root.get("DESCRIPTION") == "multi line text"
    image = root.object("IMAGE")
    assert image.get("OFFSET") == 1737400.0
    assert isinstance(image.get("OFFSET"), float)
    assert image.get("LINES") == 8
    projection = root.object("IMAGE_MAP_PROJECTION")
    assert projection.get("MAP_SCALE") == Pds3Quantity(240.0, "m/pix")
    assert projection.get("FIRST_STANDARD_PARALLEL") == "N/A"
    assert root.object("UNCOMPRESSED_FILE").get("^IMAGE") == "TINY.IMG"
    with pytest.raises(Pds3LabelError):
        projection.get("NOPE")
    with pytest.raises(Pds3LabelError):
        root.object("NOPE")


def test_parser_rejects_malformed_labels() -> None:
    with pytest.raises(Pds3LabelError):
        parse_pds3_label("OBJECT = X\nA = 1\n")  # not closed
    with pytest.raises(Pds3LabelError):
        parse_pds3_label("A 1\nEND\n")
    with pytest.raises(Pds3LabelError):
        parse_pds3_label('A = {"x", "y"\n')


def test_reader_heights_grid_and_provenance(tmp_path: Path) -> None:
    dem = read_ldem_polar(_write(tmp_path), "tiny")
    assert dem.heights_m.dtype == np.float32
    assert dem.heights_m.shape == (N, N)
    assert dem.heights_m[0, 0] == -16.0  # DN -32 * 0.5 m
    assert dem.heights_m[7, 7] == 15.5
    assert dem.reference_radius_m == 1_737_400.0
    assert dem.resolution_m == 240.0
    assert dem.grid.line_projection_offset_px == 3.5
    assert dem.frame == "MEAN EARTH/POLAR AXIS OF DE421"
    assert len(dem.sha256) == 64
    assert not dem.heights_m.flags.writeable


def test_reader_resolves_lower_case_file_names(tmp_path: Path) -> None:
    dem = read_ldem_polar(_write(tmp_path, image_name="tiny.img"), "tiny")
    assert dem.file_name == "tiny.img"
    assert resolve_pointer(tmp_path / "TINY.LBL", "TINY.IMG").name == "tiny.img"
    with pytest.raises(Pds3LabelError):
        resolve_pointer(tmp_path / "TINY.LBL", "OTHER.IMG")


def test_missing_constant_becomes_nan_never_zero(tmp_path: Path) -> None:
    dn = np.zeros((N, N), dtype="<i2")
    dn[2, 3] = -32768
    label = _write(tmp_path, dn=dn, extra_image="MISSING_CONSTANT = -32768")
    dem = read_ldem_polar(label, "tiny")
    assert np.isnan(dem.heights_m[2, 3])
    assert np.count_nonzero(np.isnan(dem.heights_m)) == 1
    # Bilinear sampling touching the hole is NaN, elsewhere finite.
    assert np.isnan(dem.sample_bilinear(2.5, 3.0))
    assert dem.sample_bilinear(5.5, 5.5) == 0.0
    assert np.isnan(dem.sample_bilinear(-0.1, 2.0))  # outside the grid


@pytest.mark.parametrize(
    ("fmt", "message"),
    [
        ({"ptype": "EQUIRECTANGULAR"}, "POLAR STEREOGRAPHIC"),
        ({"clat": "90"}, "CENTER_LATITUDE"),
        ({"frame": "PRINCIPAL AXIS"}, "COORDINATE_SYSTEM_NAME"),
    ],
)
def test_reader_refuses_mismatched_projection_or_frame(
    tmp_path: Path, fmt: dict[str, str], message: str
) -> None:
    with pytest.raises(LdemFormatError, match=message):
        read_ldem_polar(_write(tmp_path, **fmt), "tiny")


def test_reader_refuses_wrong_size_and_out_of_range_dn(tmp_path: Path) -> None:
    with pytest.raises(LdemFormatError, match="label implies"):
        read_ldem_polar(_write(tmp_path, dn=np.zeros((N, N - 1), dtype="<i2")), "tiny")
    dn = np.zeros((N, N), dtype="<i2")
    dn[0, 0] = 500
    with pytest.raises(LdemFormatError, match="DERIVED"):
        read_ldem_polar(_write(tmp_path, dn=dn), "tiny")


def test_polar_dem_validates() -> None:
    grid = PolarStereographicGrid(2, 2, 0.5, 0.5, 240.0)
    with pytest.raises(DemError):
        PolarDem(np.zeros((2, 3), np.float32), grid, 1_737_400.0, "x", "f", "0" * 64, "F")
    with pytest.raises(DemError):
        PolarDem(np.zeros((2, 2), np.float64), grid, 1_737_400.0, "x", "f", "0" * 64, "F")  # type: ignore[arg-type]
    with pytest.raises(DemError):
        PolarDem(np.zeros((2, 2), np.float32), grid, 1_000_000.0, "x", "f", "0" * 64, "F")


@pytest.mark.skipif(not REAL_LABEL.is_file(), reason="LDEM_75S_240M not acquired")
def test_real_ldem_75s_240m_reproduces_label_values() -> None:
    dem = read_ldem_polar(REAL_LABEL, "lola-ldem-75s-240m")
    assert dem.heights_m.shape == (3812, 3812)
    assert dem.sha256 == "d031efe2611b17dfbf3c158f5e15dc04cd5719349dcbf6384bb21fd97697c490"
    assert float(np.nanmin(dem.heights_m)) == -15529 * 0.5
    assert float(np.nanmax(dem.heights_m)) == 14049 * 0.5
    assert not np.isnan(dem.heights_m).any()
    # Shackleton floor near 89.67 S, 129.2 E is ~2.8 km below the sphere (PGDA: -2783 m).
    assert float(dem.height_at(-89.67, 129.2)) == pytest.approx(-2783.0, abs=30.0)
