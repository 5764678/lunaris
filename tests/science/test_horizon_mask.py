"""HorizonMask type (contract C1, task T-10)."""

from __future__ import annotations

import math
from typing import Any

import numpy as np
import pytest

from lunaris_science.coordinates import CoordinateError, SelenographicCoordinate
from lunaris_science.frames import LunarFrame
from lunaris_science.horizon_mask import HorizonMask, HorizonMaskError

SHA = "d031efe2611b17dfbf3c158f5e15dc04cd5719349dcbf6384bb21fd97697c490"


def _kwargs(n: int = 1440, **overrides: Any) -> dict[str, Any]:
    azimuth = np.arange(n) * (360.0 / n)
    values: dict[str, Any] = {
        "site": SelenographicCoordinate(-89.45, 222.69),
        "observer_height_m": 2.0,
        "surface_height_m": 1500.0,
        "azimuth_deg": azimuth,
        "elevation_deg": np.sin(np.deg2rad(azimuth)),
        "truncated": np.zeros(n, dtype=bool),
        "max_range_m": 200_000.0,
        "dem_source_id": "lola-ldem-75s-240m",
        "dem_sha256": SHA,
        "dem_resolution_m": 240.0,
        "method": "test",
    }
    values.update(overrides)
    return values


def test_valid_mask_and_properties() -> None:
    mask = HorizonMask(**_kwargs())
    assert mask.size == 1440
    assert mask.step_deg == 0.25
    assert not mask.any_truncated
    assert mask.azimuth_deg.dtype == np.float64
    assert mask.truncated.dtype == np.bool_


def test_arrays_are_copied_and_read_only() -> None:
    kwargs = _kwargs()
    source = kwargs["elevation_deg"]
    mask = HorizonMask(**kwargs)
    source[0] = 99.0
    assert mask.elevation_deg[0] == 0.0
    with pytest.raises(ValueError, match="read-only"):
        mask.elevation_deg[0] = 1.0


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"elevation_deg": np.zeros(1439)}, "equal lengths"),
        ({"truncated": np.zeros(1439, dtype=bool)}, "equal lengths"),
        ({"truncated": np.zeros(1440)}, "boolean"),
        ({"azimuth_deg": np.arange(1440) * 0.25 + 0.1}, "start at 0.0"),
        ({"azimuth_deg": np.r_[np.arange(1439) * 0.25, 359.9]}, "uniform step"),
        ({"azimuth_deg": np.arange(1440) * 0.2}, "uniform step"),  # does not close the circle
        ({"elevation_deg": np.r_[np.zeros(1439), math.nan]}, "finite"),
        ({"elevation_deg": np.r_[np.zeros(1439), 91.0]}, r"\[-90, 90\]"),
        ({"elevation_deg": np.zeros((1440, 1))}, "one-dimensional"),
        ({"observer_height_m": -1.0}, "non-negative"),
        ({"surface_height_m": math.inf}, "finite"),
        ({"max_range_m": 0.0}, "positive"),
        ({"dem_resolution_m": -240.0}, "positive"),
        ({"dem_sha256": "abc"}, "64 lower-case"),
        ({"dem_sha256": SHA.upper()}, "64 lower-case"),
        ({"dem_source_id": " "}, "dem_source_id"),
        ({"method": ""}, "method"),
    ],
)
def test_validation(overrides: dict[str, Any], message: str) -> None:
    with pytest.raises(HorizonMaskError, match=message):
        HorizonMask(**_kwargs(**overrides))


def test_needs_at_least_360_samples() -> None:
    HorizonMask(**_kwargs(n=360))
    with pytest.raises(HorizonMaskError, match="at least 360"):
        HorizonMask(**_kwargs(n=359))


def test_pole_site_is_rejected() -> None:
    with pytest.raises(CoordinateError):
        HorizonMask(**_kwargs(site=SelenographicCoordinate(-90.0, 0.0)))


def test_site_must_be_moon_me() -> None:
    site = SelenographicCoordinate(-89.0, 0.0, frame=LunarFrame.MOON_PA)
    with pytest.raises(HorizonMaskError, match="MOON_ME"):
        HorizonMask(**_kwargs(site=site))


def test_elevation_at_is_linear_and_periodic() -> None:
    n = 360
    elevation = np.zeros(n)
    elevation[0] = 2.0
    elevation[-1] = 1.0  # azimuth 359
    elevation[10] = 4.0
    mask = HorizonMask(**_kwargs(n=n, elevation_deg=elevation))
    np.testing.assert_allclose(
        mask.elevation_at([0.0, 359.5, 360.0, -0.5, 9.5, 10.0, 725.0]),
        [2.0, 1.5, 2.0, 1.5, 2.0, 4.0, 0.0],
    )


def test_truncated_at_uses_bracketing_samples() -> None:
    n = 360
    truncated = np.zeros(n, dtype=bool)
    truncated[5] = True
    mask = HorizonMask(**_kwargs(n=n, truncated=truncated))
    assert mask.any_truncated
    np.testing.assert_array_equal(
        mask.truncated_at([4.0, 4.5, 5.0, 5.5, 6.0, 6.5]),
        [False, True, True, True, False, False],
    )
    with pytest.raises(HorizonMaskError):
        mask.elevation_at(math.nan)
