// @vitest-environment jsdom
import type { Evidence } from "@lunaris/shared-types";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { toElevationSeries } from "@/lib/timeline/series";
import { useMissionStore } from "@/store/mission-store";

import { TimelineTrack } from "./timeline-track";

const react = vi.fn(() => Promise.resolve());
vi.mock("./plotly-loader", () => ({
  loadPlotly: () => Promise.resolve({ react, purge: vi.fn() }),
}));

// SYNTHETIC test fixture — invented values that exercise the UI, not lunar geometry.
const EVIDENCE: Evidence = {
  kind: "model",
  statement: "SYNTHETIC test fixture.",
  sources: [],
  method: "test",
  assumptions: [],
};

const T0 = Date.UTC(2026, 10, 4, 0);
const HOUR = 3_600_000;

function sunSeries() {
  return toElevationSeries(
    "sun",
    [0, 1, 2].map((h) => ({
      epoch_utc: new Date(T0 + h * HOUR).toISOString(),
      azimuth_deg: 0,
      elevation_deg: h - 1,
      range_m: 1.5e11,
      angular_radius_deg: 0.27,
      direction_moon_me: [1, 0, 0] as [number, number, number],
    })),
    EVIDENCE,
  );
}

function renderTrack(lanes = {}) {
  return render(
    <TooltipProvider>
      <TimelineTrack lanes={lanes} />
    </TooltipProvider>,
  );
}

beforeEach(() => {
  useMissionStore.getState().initializeTime(T0);
  useMissionStore.getState().setEpoch(T0 + 1.5 * HOUR);
  react.mockClear();
});
afterEach(cleanup);

describe("TimelineTrack lanes", () => {
  it("shows every lane as not computed when there is no data", () => {
    const { container } = renderTrack();
    const lanes = container.querySelectorAll("[data-lane]");
    expect(lanes).toHaveLength(4);
    for (const lane of lanes) {
      expect(lane.getAttribute("data-lane-state")).toBe("not-computed");
      expect(lane.textContent).toContain("Not computed");
    }
    expect(react).not.toHaveBeenCalled();
  });

  it("plots a computed lane with its evidence badge and cursor readout; others stay not computed", async () => {
    const { container } = renderTrack({ sun: sunSeries() });
    const sun = container.querySelector('[data-lane="sun"]')!;
    expect(sun.getAttribute("data-lane-state")).toBe("computed");
    expect(container.querySelector('[data-lane="earth"]')!.getAttribute("data-lane-state")).toBe(
      "not-computed",
    );
    // Epoch 01:30 between +0° (01:00) and +1° (02:00).
    expect(screen.getByTestId("lane-readout-sun").textContent).toBe("+0.50°");
    expect(container.querySelector('[data-evidence="model"]')).not.toBeNull();
    await waitFor(() => expect(react).toHaveBeenCalledTimes(1));
    const [, traces, , config] = react.mock.calls[0] as unknown as [
      unknown,
      { y: number[] }[],
      unknown,
      object,
    ];
    expect(traces.at(-1)!.y).toEqual([-1, 0, 1]);
    expect(config).toMatchObject({ staticPlot: true });
  });

  it("shows a dash outside the sampled span instead of extrapolating", () => {
    useMissionStore.getState().setEpoch(T0 + 5 * HOUR);
    renderTrack({ sun: sunSeries() });
    expect(screen.getByTestId("lane-readout-sun").textContent).toBe("—");
  });
});
