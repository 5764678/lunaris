import { beforeEach, describe, expect, it } from "vitest";

import { DAY_MS, DEFAULT_WINDOW_MS, HOUR_MS, MINUTE_MS } from "@/lib/time/time";

import { useMissionStore } from "./mission-store";

const NOW = Date.UTC(2026, 10, 4, 9, 30, 42);
const START = Date.UTC(2026, 10, 4, 9, 30);
const initial = useMissionStore.getState();

describe("mission store timeline", () => {
  beforeEach(() => useMissionStore.setState(initial, true));

  it("starts without time until initialized after mount", () => {
    expect(useMissionStore.getState().epochMs).toBeNull();
    useMissionStore.getState().initializeTime(NOW);
    const s = useMissionStore.getState();
    expect(s.epochMs).toBe(START);
    expect(s.windowEndMs! - s.windowStartMs!).toBe(DEFAULT_WINDOW_MS);
    // Initialization is idempotent.
    useMissionStore.getState().initializeTime(NOW + DAY_MS);
    expect(useMissionStore.getState().epochMs).toBe(START);
  });

  it("clamps manual changes to the analysis window", () => {
    const store = useMissionStore.getState();
    store.initializeTime(NOW);
    store.stepEpoch(-HOUR_MS);
    expect(useMissionStore.getState().epochMs).toBe(START);
    store.setEpoch(START + 365 * DAY_MS);
    expect(useMissionStore.getState().epochMs).toBe(START + DEFAULT_WINDOW_MS);
  });

  it("advances at the playback rate and stops at the window end", () => {
    const store = useMissionStore.getState();
    store.initializeTime(NOW);
    store.setRate(3_600); // 1 simulated hour per real second
    store.advance(1_000);
    expect(useMissionStore.getState().epochMs).toBe(START); // not playing yet
    store.setPlaying(true);
    store.advance(1_000);
    expect(useMissionStore.getState().epochMs).toBe(START + HOUR_MS);
    store.advance(10_000_000);
    const end = useMissionStore.getState();
    expect(end.epochMs).toBe(START + DEFAULT_WINDOW_MS);
    expect(end.playing).toBe(false);
    // Pressing play at the end restarts from the window start.
    store.setPlaying(true);
    expect(useMissionStore.getState().epochMs).toBe(START);
  });

  it("re-centres the window on reset", () => {
    const store = useMissionStore.getState();
    store.initializeTime(NOW);
    store.resetToNow(NOW + 2 * DAY_MS + 5 * MINUTE_MS);
    expect(useMissionStore.getState().epochMs).toBe(START + 2 * DAY_MS + 5 * MINUTE_MS);
  });

  it("re-triggers identical view requests", () => {
    const store = useMissionStore.getState();
    store.requestView("south-pole");
    const first = useMissionStore.getState().view.requestId;
    store.requestView("south-pole");
    expect(useMissionStore.getState().view.requestId).toBe(first + 1);
  });
});
