"""Timelines and summaries from per-epoch visible disk fractions (D4, C4, T-24).

Inputs are a uniform series of epochs (seconds, any origin) and the visible fraction f of
a disk at each epoch (:mod:`~lunaris_science.illumination.disk_fraction`). Outputs are
the windows in which a condition on f holds, and the summary statistics of C4.

Definitions (also in ``docs/SCIENCE.md`` §5.3):

* Each sample stands for the interval [t, t + step) **clipped to the analysis window**
  [start, end]. With an end-inclusive grid (the last epoch equals ``end``), the last
  sample's interval is empty and it carries weight 0. A **window** is a maximal run of
  consecutive samples meeting the condition, from the first sample's epoch to the end of
  the last sample's clipped interval. Window edges are known only to within one step
  (``resolution_s``). Visible and hidden windows together tile [start, end] exactly.
* A window that touches the start or end of the analysis window is **censored**: the
  body may have been visible (or hidden) before or after it. Its duration is a lower
  bound, and the summary says when the longest window is censored.
* All fractions are weighted by each sample's clipped interval.
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
    window_start_s: float
    window_end_s: float
    mean_visible_disk_fraction: float
    illuminated_fraction: float
    fully_visible_fraction: float
    longest_visible: LongestRun
    """Longest run with any of the disk visible (f > 0)."""
    longest_hidden: LongestRun
    """Longest run with the disk fully hidden (f = 0)."""
    visible_windows: tuple[Window, ...]
    hidden_windows: tuple[Window, ...]
    """Visible and hidden windows together tile the analysis window exactly."""
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


def _window_end(t: FloatArray, window_end_s: float | None) -> float:
    end = float(t[-1]) if window_end_s is None else float(window_end_s)
    if not math.isfinite(end) or end < t[-1]:
        raise TimelineError("the analysis window must end at or after the last sample")
    return end


def sample_weights(epochs_s: ArrayLike, window_end_s: float | None = None) -> FloatArray:
    """Length of each sample's interval [t, t + step) clipped to the analysis window.

    ``window_end_s`` defaults to the last epoch (an end-inclusive grid), in which case the
    last sample has weight 0. The weights sum to ``window_end − t[0]`` exactly up to
    floating-point rounding.
    """
    t = np.asarray(epochs_s, dtype=np.float64)
    _, _, step = _validate(t, np.zeros_like(t))
    end = _window_end(t, window_end_s)
    weights: FloatArray = np.minimum(t + step, end) - t
    return weights


def windows(
    epochs_s: ArrayLike, condition: ArrayLike, window_end_s: float | None = None
) -> tuple[Window, ...]:
    """Maximal runs of consecutive samples where ``condition`` is true, each sample's
    interval clipped to the analysis window. Runs of zero clipped length are dropped."""
    t = np.asarray(epochs_s, dtype=np.float64)
    c = np.asarray(condition, dtype=np.bool_)
    _, _, step = _validate(t, c.astype(np.float64))
    end = _window_end(t, window_end_s)
    padded = np.concatenate([[False], c, [False]])
    edges = np.flatnonzero(np.diff(padded.astype(np.int8)))
    starts, stops = edges[0::2], edges[1::2] - 1
    runs = []
    for i, j in zip(starts, stops, strict=True):
        start_s = float(t[i])
        end_s = min(float(t[j]) + step, end)
        if end_s <= start_s:
            continue
        runs.append(
            Window(
                start_index=int(i),
                end_index=int(j),
                start_s=start_s,
                end_s=end_s,
                duration_s=end_s - start_s,
                censored_start=bool(i == 0),
                censored_end=bool(end_s >= end),
            )
        )
    return tuple(runs)


def _longest(runs: tuple[Window, ...]) -> LongestRun:
    if not runs:
        return LongestRun(duration_s=0.0, censored=False)
    longest = max(runs, key=lambda w: (w.duration_s, w.censored))
    ties = [w for w in runs if math.isclose(w.duration_s, longest.duration_s)]
    return LongestRun(duration_s=longest.duration_s, censored=any(w.censored for w in ties))


def summarize(
    epochs_s: ArrayLike,
    fraction: ArrayLike,
    truncated: ArrayLike | None = None,
    *,
    window_end_s: float | None = None,
) -> FractionSummary:
    """C4 summary statistics of a visible-fraction series (definitions in the module doc).

    The analysis window is [epochs[0], window_end_s]; ``window_end_s`` defaults to the last
    epoch (end-inclusive grid). Fractions are weighted by each sample's clipped interval.
    """
    t, f, step = _validate(epochs_s, fraction)
    end = _window_end(t, window_end_s)
    weights = sample_weights(t, end)
    total = float(np.sum(weights))
    if total <= 0.0:
        raise TimelineError("the analysis window has zero length")
    visible = f > 0.0
    hidden = ~visible
    any_truncated = (
        bool(np.any(np.asarray(truncated, dtype=np.bool_))) if truncated is not None else False
    )
    return FractionSummary(
        sample_count=int(t.size),
        step_s=step,
        resolution_s=step,
        window_start_s=float(t[0]),
        window_end_s=end,
        mean_visible_disk_fraction=float(np.sum(weights * f) / total),
        illuminated_fraction=float(np.sum(weights * visible) / total),
        fully_visible_fraction=float(np.sum(weights * (f >= 1.0)) / total),
        longest_visible=_longest(windows(t, visible, end)),
        longest_hidden=_longest(windows(t, hidden, end)),
        visible_windows=windows(t, visible, end),
        hidden_windows=windows(t, hidden, end),
        any_truncated=any_truncated,
    )


__all__ = [
    "FractionSummary",
    "LongestRun",
    "TimelineError",
    "Window",
    "sample_weights",
    "summarize",
    "windows",
]
