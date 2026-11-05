"""Timelines and summaries from per-epoch visible disk fractions (D4, C4, T-24).

Inputs are a uniform series of epochs (seconds, any origin) and the visible fraction f of
a disk at each epoch (:mod:`~lunaris_science.illumination.disk_fraction`). Outputs are
the windows in which a condition on f holds, and the summary statistics of C4.

Definitions (also in ``docs/SCIENCE.md`` §5.3):

* Each sample stands for the interval [t, t + step). A **window** is a maximal run of
  consecutive samples meeting the condition. It starts at the first sample's epoch and
  lasts ``(number of samples) × step``. Window edges are therefore known only to within
  one step, reported as ``resolution_s``.
* A window that touches the start or end of the analysis window is **censored**: the
  body may have been visible (or hidden) before or after it. Its duration is a lower
  bound, and the summary says when the longest window is censored.
* ``mean_visible_disk_fraction`` is the time average of f, comparable to the "average
  illumination" of published polar studies.
* ``illuminated_fraction`` is the share of samples with any part of the disk visible
  (f > 0). It is always ≥ the mean fraction.
* ``fully_visible_fraction`` is the share of samples with the whole disk visible (f = 1).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import ArrayLike, NDArray

FloatArray = NDArray[np.float64]
BoolArray = NDArray[np.bool_]

UNIFORM_STEP_TOLERANCE_S = 1.5
"""Allowed deviation from the nominal step: absorbs one leap second inside a UTC grid."""


class TimelineError(ValueError):
    """Raised for malformed epoch or fraction series."""


@dataclass(frozen=True, slots=True)
class Window:
    """A maximal run of samples meeting a condition."""

    start_index: int
    end_index: int
    """Inclusive index of the last sample in the run."""
    start_s: float
    end_s: float
    """End of the last sample's interval: epoch of the last sample + step."""
    duration_s: float
    censored_start: bool
    censored_end: bool

    @property
    def censored(self) -> bool:
        return self.censored_start or self.censored_end


@dataclass(frozen=True, slots=True)
class LongestRun:
    duration_s: float
    """0 when the condition never holds."""
    censored: bool
    """True when the longest run touches the analysis window edge (duration is a lower bound)."""


@dataclass(frozen=True, slots=True)
class FractionSummary:
    sample_count: int
    step_s: float
    resolution_s: float
    mean_visible_disk_fraction: float
    illuminated_fraction: float
    fully_visible_fraction: float
    longest_visible: LongestRun
    """Longest run with any of the disk visible (f > 0)."""
    longest_hidden: LongestRun
    """Longest run with the disk fully hidden (f = 0)."""
    visible_windows: tuple[Window, ...]
    any_truncated: bool
    """True if any sample's fraction depends on a truncated horizon (an upper bound there)."""


def _validate(epochs_s: ArrayLike, fraction: ArrayLike) -> tuple[FloatArray, FloatArray, float]:
    t = np.asarray(epochs_s, dtype=np.float64)
    f = np.asarray(fraction, dtype=np.float64)
    if t.ndim != 1 or f.shape != t.shape:
        raise TimelineError("epochs and fractions must be 1-D arrays of equal length")
    if t.size == 0:
        raise TimelineError("at least one sample is required")
    if not (np.all(np.isfinite(t)) and np.all(np.isfinite(f))):
        raise TimelineError("epochs and fractions must be finite")
    if np.any((f < 0.0) | (f > 1.0)):
        raise TimelineError("fractions must lie in [0, 1]")
    if t.size == 1:
        raise TimelineError("at least two samples are required to define a step")
    steps = np.diff(t)
    step = float(np.median(steps))
    if step <= 0.0 or np.any(np.abs(steps - step) > UNIFORM_STEP_TOLERANCE_S):
        raise TimelineError("epochs must be increasing with a uniform step")
    return t, f, step


def windows(epochs_s: ArrayLike, condition: ArrayLike) -> tuple[Window, ...]:
    """Maximal runs of consecutive samples where ``condition`` is true."""
    t = np.asarray(epochs_s, dtype=np.float64)
    c = np.asarray(condition, dtype=np.bool_)
    _, _, step = _validate(t, c.astype(np.float64))
    padded = np.concatenate([[False], c, [False]])
    edges = np.flatnonzero(np.diff(padded.astype(np.int8)))
    starts, stops = edges[0::2], edges[1::2] - 1
    last = t.size - 1
    return tuple(
        Window(
            start_index=int(i),
            end_index=int(j),
            start_s=float(t[i]),
            end_s=float(t[j] + step),
            duration_s=float(t[j] + step - t[i]),
            censored_start=bool(i == 0),
            censored_end=bool(j == last),
        )
        for i, j in zip(starts, stops, strict=True)
    )


def _longest(runs: tuple[Window, ...]) -> LongestRun:
    if not runs:
        return LongestRun(duration_s=0.0, censored=False)
    longest = max(runs, key=lambda w: (w.duration_s, w.censored))
    ties = [w for w in runs if math.isclose(w.duration_s, longest.duration_s)]
    return LongestRun(duration_s=longest.duration_s, censored=any(w.censored for w in ties))


def summarize(
    epochs_s: ArrayLike, fraction: ArrayLike, truncated: ArrayLike | None = None
) -> FractionSummary:
    """C4 summary statistics of a visible-fraction series (definitions in the module doc)."""
    t, f, step = _validate(epochs_s, fraction)
    visible = f > 0.0
    hidden = ~visible
    visible_runs = windows(t, visible)
    hidden_runs = windows(t, hidden)
    any_truncated = (
        bool(np.any(np.asarray(truncated, dtype=np.bool_))) if truncated is not None else False
    )
    return FractionSummary(
        sample_count=int(t.size),
        step_s=step,
        resolution_s=step,
        mean_visible_disk_fraction=float(np.mean(f)),
        illuminated_fraction=float(np.mean(visible)),
        fully_visible_fraction=float(np.mean(f >= 1.0)),
        longest_visible=_longest(visible_runs),
        longest_hidden=_longest(hidden_runs),
        visible_windows=visible_runs,
        any_truncated=any_truncated,
    )


__all__ = [
    "FractionSummary",
    "LongestRun",
    "TimelineError",
    "Window",
    "summarize",
    "windows",
]
