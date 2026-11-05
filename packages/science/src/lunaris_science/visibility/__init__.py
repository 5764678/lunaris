"""Earth visibility (Milestone 04, T-24).

Geometric line of sight from a surface site to the Earth, derived from visible disk
fractions (:mod:`lunaris_science.illumination.disk_fraction`) against the astronomical
horizon and, when a horizon mask is available, the terrain horizon.

Scope limitation:
    Geometric line of sight is a necessary but NOT a sufficient condition for radio
    communication. Link budgets, antenna patterns, ground-station availability and
    multipath are outside the scope of this module and must not be inferred from its
    outputs (:data:`RADIO_LINK_DISCLAIMER`).
"""

from __future__ import annotations

from enum import StrEnum

import numpy as np
from numpy.typing import ArrayLike, NDArray

RADIO_LINK_DISCLAIMER = (
    "Geometric line of sight only: Earth visibility does not imply a radio link. Link "
    "budget, antenna patterns and pointing, ground-station availability and multipath are "
    "not modelled."
)


class EarthLineOfSight(StrEnum):
    """Line-of-sight state to the Earth's disk at one epoch.

    * ``clear``: part of the disk is above the horizon used (the terrain horizon when one
      is given, otherwise the astronomical horizon). From a peak the terrain horizon can
      dip below 0°, so ``clear`` is possible with the disk below the astronomical horizon.
    * ``terrain_obstructed``: part of the disk is above the astronomical horizon, but none
      of it is above the terrain horizon.
    * ``below_geometric_horizon``: no part of the disk is above either horizon.
    """

    CLEAR = "clear"
    TERRAIN_OBSTRUCTED = "terrain_obstructed"
    BELOW_GEOMETRIC_HORIZON = "below_geometric_horizon"


def classify_line_of_sight(
    astronomical_fraction: ArrayLike, terrain_fraction: ArrayLike | None = None
) -> NDArray[np.str_]:
    """Per-epoch :class:`EarthLineOfSight` values from visible disk fractions."""
    astro = np.asarray(astronomical_fraction, dtype=np.float64)
    above_astro = astro > 0.0
    if terrain_fraction is None:
        above_terrain = above_astro
    else:
        above_terrain = np.asarray(terrain_fraction, dtype=np.float64) > 0.0
    return np.where(
        above_terrain,
        EarthLineOfSight.CLEAR.value,
        np.where(
            above_astro,
            EarthLineOfSight.TERRAIN_OBSTRUCTED.value,
            EarthLineOfSight.BELOW_GEOMETRIC_HORIZON.value,
        ),
    )


__all__ = ["RADIO_LINK_DISCLAIMER", "EarthLineOfSight", "classify_line_of_sight"]
