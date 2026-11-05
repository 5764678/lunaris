"""T-24 (core): windows and C4 summaries from visible-fraction series. Synthetic inputs."""

from __future__ import annotations

import itertools

import numpy as np
import pytest

from lunaris_science.illumination.timeline import TimelineError, summarize, windows

STEP = 3600.0


def _t(n: int) -> np.ndarray:
    return np.arange(n) * STEP


def test_windows_are_maximal_runs_clipped_to_the_analysis_window() -> None:
    """End-inclusive grid of 9 samples: window [t0, t8]; the last sample has weight 0."""
    condition = [True, True, False, False, True, False, True, True, True]
    runs = windows(_t(9), condition)
    assert [(w.start_index, w.end_index) for w in runs] == [(0, 1), (4, 4), (6, 8)]
    assert [w.duration_s for w in runs] == [2 * STEP, STEP, 2 * STEP]
    assert runs[2].end_s == 8 * STEP  # clipped: not 9 h
    assert [(w.censored_start, w.censored_end) for w in runs] == [
        (True, False),
        (False, False),
        (False, True),
    ]


def test_an_explicit_window_end_off_the_grid_clips_the_last_interval() -> None:
    runs = windows(_t(3), [True, True, True], window_end_s=2.5 * STEP)
    assert len(runs) == 1
    assert runs[0].duration_s == 2.5 * STEP
    assert runs[0].censored_end


def test_no_window_when_the_condition_never_holds() -> None:
    assert windows(_t(5), [False] * 5) == ()


def test_summary_definitions() -> None:
    """End-inclusive grid of 10 samples: window [t0, t9]; samples 0–8 weigh 1 h each and
    sample 9 weighs 0."""
    f = np.array([0.0, 0.0, 0.25, 0.5, 1.0, 1.0, 0.0, 0.0, 0.0, 0.75])
    s = summarize(_t(10), f)
    assert s.sample_count == 10
    assert s.step_s == s.resolution_s == STEP
    assert (s.window_start_s, s.window_end_s) == (0.0, 9 * STEP)
    assert s.mean_visible_disk_fraction == pytest.approx(2.75 / 9)
    assert s.illuminated_fraction == pytest.approx(4 / 9)
    assert s.fully_visible_fraction == pytest.approx(2 / 9)
    assert s.illuminated_fraction >= s.mean_visible_disk_fraction
    # Visible: samples 2–5 (4 h, interior); sample 9 has zero length and is dropped.
    assert s.longest_visible.duration_s == 4 * STEP
    assert not s.longest_visible.censored
    assert len(s.visible_windows) == 1
    # Hidden: 0–1 (2 h, censored start) and 6–8 (3 h, reaches the window end: censored).
    assert s.longest_hidden.duration_s == 3 * STEP
    assert s.longest_hidden.censored
    assert not s.any_truncated


@pytest.mark.parametrize("seed", range(20))
def test_visible_and_hidden_windows_tile_the_analysis_window_exactly(seed: int) -> None:
    rng = np.random.default_rng(seed)
    n = int(rng.integers(2, 200))
    f = np.where(rng.random(n) < 0.5, 0.0, rng.random(n))
    end = (n - 1) * STEP + float(rng.choice([0.0, 0.3 * STEP]))
    s = summarize(_t(n), f, window_end_s=end)
    total = sum(w.duration_s for w in s.visible_windows + s.hidden_windows)
    assert total == pytest.approx(end, abs=1e-6)
    spans = sorted((w.start_s, w.end_s) for w in s.visible_windows + s.hidden_windows)
    assert spans[0][0] == 0.0
    assert spans[-1][1] == pytest.approx(end)
    for (_, prev_end), (start, _) in itertools.pairwise(spans):
        assert start == pytest.approx(prev_end)


def test_window_end_before_the_last_sample_is_rejected() -> None:
    with pytest.raises(TimelineError, match="at or after the last sample"):
        summarize(_t(3), [1.0, 1.0, 1.0], window_end_s=STEP)


def test_longest_run_reports_censoring_when_it_touches_the_window_edge() -> None:
    s = summarize(_t(6), [1.0, 1.0, 1.0, 0.0, 1.0, 0.0])
    assert s.longest_visible.duration_s == 3 * STEP
    assert s.longest_visible.censored
    always = summarize(_t(4), [0.6] * 4)
    assert always.longest_visible.duration_s == 3 * STEP  # [t0, t3], not 4 h
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
