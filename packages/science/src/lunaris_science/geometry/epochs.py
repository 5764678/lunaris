"""UTC epoch grids and UTC → ET conversion.

The API takes and returns ISO 8601 UTC. Geometry is evaluated at ephemeris time (ET,
TDB seconds past J2000), converted through the leap-seconds kernel loaded in the
:class:`~lunaris_science.geometry.spice.SpiceContext` (contract C0).

A grid is uniform in UTC: sample *k* is ``start + k·step``. Each sample is converted to ET
individually, so a leap second inside a window is handled correctly (the ET spacing
across it is then ``step + 1 s``).
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

import numpy as np
import spiceypy
from numpy.typing import NDArray

from lunaris_science.geometry.spice import SpiceContext

FloatArray = NDArray[np.float64]

_SPICE_UTC_FORMAT = "%Y-%m-%dT%H:%M:%S.%f"


class EpochError(ValueError):
    """Raised for invalid epochs, windows or steps."""


def _require_utc(value: datetime, name: str) -> datetime:
    if value.tzinfo is None or value.utcoffset() != timedelta(0):
        raise EpochError(f"{name} must be timezone-aware UTC, got {value!r}")
    return value.astimezone(UTC)


def uniform_utc_grid(start_utc: datetime, end_utc: datetime, step_s: float) -> tuple[datetime, ...]:
    """Epochs ``start + k·step`` for every k with ``start + k·step ≤ end``.

    Both ends must be timezone-aware UTC. ``end == start`` yields one sample.

    Raises:
        EpochError: for naive or non-UTC datetimes, ``end < start`` or a non-positive step.
    """
    start = _require_utc(start_utc, "start_utc")
    end = _require_utc(end_utc, "end_utc")
    if not math.isfinite(step_s) or step_s <= 0.0:
        raise EpochError(f"step_s must be a positive finite number of seconds, got {step_s}")
    if end < start:
        raise EpochError("end_utc must not be earlier than start_utc")
    count = sample_count(start, end, step_s)
    return tuple(start + timedelta(seconds=k * step_s) for k in range(count))


def sample_count(start_utc: datetime, end_utc: datetime, step_s: float) -> int:
    """Number of samples :func:`uniform_utc_grid` returns, without building the grid."""
    span_s = (end_utc - start_utc).total_seconds()
    # The epsilon absorbs float rounding when the span is an exact multiple of the step.
    return math.floor(span_s / step_s + 1e-9) + 1


def utc_to_et(context: SpiceContext, epochs_utc: Sequence[datetime]) -> FloatArray:
    """Convert timezone-aware UTC datetimes to ET seconds past J2000 (TDB)."""
    strings = [_require_utc(t, "epoch").strftime(_SPICE_UTC_FORMAT) for t in epochs_utc]
    with context.session():
        return np.array([spiceypy.str2et(s) for s in strings], dtype=np.float64)


__all__ = ["EpochError", "sample_count", "uniform_utc_grid", "utc_to_et"]
