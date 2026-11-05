"""T-24 (core): windows and C4 summaries from visible-fraction series. Synthetic inputs."""

from __future__ import annotations

import numpy as np
import pytest

from lunaris_science.illumination.timeline import TimelineError, summarize, windows

STEP = 3600.0


def _t(n: int) -> np.ndarray:
    return np.arange(n) * STEP


def test_windows_are_maximal_runs_with_sample_durations_and_censoring() -> None:
    condition = [True, True, False, False, True, False, True, True, True]
    runs = windows(_t(9), condition)
    assert [(w.start_index, w.end_index) for w in runs] == [(0, 1), (4, 4), (6, 8)]
    assert [w.duration_s for w in runs] == [2 * STEP, STEP, 3 * STEP]
    assert runs[1].start_s == 4 * STEP
    assert runs[1].end_s == 5 * STEP
    assert [(w.censored_start, w.censored_end) for w in runs] == [
        (True, False),
        (False, False),
        (False, True),
    ]


def test_no_window_when_the_condition_never_holds() -> None:
    assert windows(_t(5), [False] * 5) == ()


def test_summary_definitions() -> None:
    f = np.array([0.0, 0.0, 0.25, 0.5, 1.0, 1.0, 0.0, 0.0, 0.0, 0.75])
    s = summarize(_t(10), f)
    assert s.sample_count == 10
    assert s.step_s == s.resolution_s == STEP
    assert s.mean_visible_disk_fraction == pytest.approx(0.35)
    assert s.illuminated_fraction == pytest.approx(0.5)
    assert s.fully_visible_fraction == pytest.approx(0.2)
    assert s.illuminated_fraction >= s.mean_visible_disk_fraction
    # Visible runs: samples 2–5 (4 h, interior) and 9 (1 h, censored at the end).
    assert s.longest_visible.duration_s == 4 * STEP
    assert not s.longest_visible.censored
    # Hidden runs: 0–1 (censored start, 2 h) and 6–8 (3 h, interior).
    assert s.longest_hidden.duration_s == 3 * STEP
    assert not s.longest_hidden.censored
    assert len(s.visible_windows) == 2
    assert not s.any_truncated


def test_longest_run_reports_censoring_when_it_touches_the_window_edge() -> None:
    s = summarize(_t(6), [1.0, 1.0, 1.0, 0.0, 1.0, 0.0])
    assert s.longest_visible.duration_s == 3 * STEP
    assert s.longest_visible.censored
    always = summarize(_t(4), [0.6] * 4)
    assert always.longest_visible.duration_s == 4 * STEP
    assert always.longest_visible.censored
    assert always.longest_hidden.duration_s == 0.0
    assert not always.longest_hidden.censored


def test_equal_length_runs_report_censoring_if_any_of_them_is_censored() -> None:
    s = summarize(_t(5), [1.0, 0.0, 0.0, 1.0, 0.0])
    assert s.longest_visible.duration_s == STEP
    assert s.longest_visible.censored


def test_truncation_propagates_to_the_summary() -> None:
    s = summarize(_t(3), [0.0, 0.5, 1.0], truncated=[False, True, False])
    assert s.any_truncated


def test_a_leap_second_inside_the_grid_is_tolerated() -> None:
    t = _t(5)
    t[3:] += 1.0
    assert summarize(t, [1.0] * 5).sample_count == 5


@pytest.mark.parametrize(
    ("epochs", "fraction", "message"),
    [
        (np.arange(3.0), [0.0, 1.5, 0.0], r"\[0, 1\]"),
        (np.array([0.0, 2.0, 10.0]), [0.0, 0.0, 0.0], "uniform"),
        (np.array([0.0]), [0.0], "two samples"),
        (np.arange(3.0), [0.0, np.nan, 0.0], "finite"),
        (np.arange(3.0), [0.0, 0.0], "equal length"),
    ],
)
def test_malformed_series_are_rejected(
    epochs: np.ndarray, fraction: list[float], message: str
) -> None:
    with pytest.raises(TimelineError, match=message):
        summarize(epochs, fraction)
