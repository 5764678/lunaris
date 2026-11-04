"""Illumination analysis (Milestone 04).

Implemented:

* :mod:`~lunaris_science.illumination.disk_fraction` — visible fraction of a body's
  disk (Sun or Earth) above a horizon profile: the terrain horizon from a horizon mask
  (C1) or the flat astronomical horizon (D4, T-23). Resolves horizons that slope or step
  within the disk's width.

Planned (T-24): illumination and Earth-visibility timelines and summaries built on these
fractions, with the astronomical and terrain horizons reported separately.
"""

from lunaris_science.illumination.disk_fraction import (
    DEFAULT_NODES,
    DiskFractionError,
    DiskFractionResult,
    HorizonProfile,
    straight_horizon_fraction,
    visible_disk_fraction,
)

__all__ = [
    "DEFAULT_NODES",
    "DiskFractionError",
    "DiskFractionResult",
    "HorizonProfile",
    "straight_horizon_fraction",
    "visible_disk_fraction",
]
