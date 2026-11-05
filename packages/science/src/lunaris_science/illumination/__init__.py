"""Illumination analysis (Milestone 04).

Implemented:

* :mod:`~lunaris_science.illumination.disk_fraction` — visible fraction of a body's
  disk (Sun or Earth) above a horizon profile: the terrain horizon from a horizon mask
  (C1) or the flat astronomical horizon (D4, T-23). Resolves horizons that slope or step
  within the disk's width.

* :mod:`~lunaris_science.illumination.timeline` — windows and C4 summaries (mean visible
  disk fraction, illuminated fraction, longest runs with censoring) from fraction series.
* :mod:`~lunaris_science.illumination.analysis` — per-body timelines against the
  astronomical and terrain horizons, reported separately, with evidence (T-24).
"""

from lunaris_science.illumination.disk_fraction import (
    ASTRONOMICAL_HORIZON,
    DEFAULT_NODES,
    DiskFractionError,
    DiskFractionResult,
    FlatHorizon,
    HorizonLike,
    straight_horizon_fraction,
    visible_disk_fraction,
)

__all__ = [
    "ASTRONOMICAL_HORIZON",
    "DEFAULT_NODES",
    "DiskFractionError",
    "DiskFractionResult",
    "FlatHorizon",
    "HorizonLike",
    "straight_horizon_fraction",
    "visible_disk_fraction",
]
