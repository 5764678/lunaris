/**
 * Client-side mission workspace state: analysis epoch and window, playback, selection,
 * camera view requests and layer visibility.
 *
 * Time state starts as `null` and is initialized after mount, so prerendered HTML never
 * contains a build-time timestamp (and Cache Components prerendering never calls
 * `Date.now()`).
 */
import { create } from "zustand";

import { DEFAULT_WINDOW_MS, MINUTE_MS, clamp } from "@/lib/time/time";

export type ViewPreset = "south-polar" | "south-pole" | "near-side" | "far-side";

/** Which 3D scene the viewport shows: the global context globe or the south-pole terrain (D5). */
export type SceneMode = "globe" | "terrain";

/** Camera distance (lunar radii) the globe flies down to before handing over to the terrain. */
export const TERRAIN_DESCENT_DISTANCE = 1.15;

export interface LayerVisibility {
  graticule: boolean;
  sites: boolean;
  labels: boolean;
}

export interface MissionState {
  epochMs: number | null;
  windowStartMs: number | null;
  windowEndMs: number | null;
  playing: boolean;
  /** Simulated seconds per real second. */
  rate: number;
  selectedSiteId: string | null;
  /** True once the first-visit default site has been dealt with, so a visitor who deselects it is not given it again. */
  defaultSiteApplied: boolean;
  /** Camera preset request; `requestId` changes on every request so repeats re-trigger.
   *  `distance` overrides the preset's distance (used for the descent to the terrain). */
  view: { preset: ViewPreset; requestId: number; distance?: number };
  scene: SceneMode;
  /** `descending`: the globe camera is flying down to the pole before the terrain mounts. */
  sceneTransition: "idle" | "descending";
  layers: LayerVisibility;

  initializeTime: (nowMs: number) => void;
  resetToNow: (nowMs: number) => void;
  setEpoch: (ms: number) => void;
  stepEpoch: (deltaMs: number) => void;
  setPlaying: (playing: boolean) => void;
  setRate: (rate: number) => void;
  /** Advance the epoch by `realElapsedMs × rate` while playing; stops at the window end. */
  advance: (realElapsedMs: number) => void;
  selectSite: (siteId: string | null) => void;
  /**
   * Select the first-visit default site, once. Does nothing if it was already applied or the
   * visitor has selected a site; `null` (no suitable site) still counts as applied.
   */
  applyDefaultSite: (siteId: string | null) => void;
  requestView: (preset: ViewPreset) => void;
  toggleLayer: (layer: keyof LayerVisibility) => void;
  /** Globe → pole: fly the globe camera down to the pole, then show the terrain. */
  enterTerrain: () => void;
  /** Called by the viewport when the descent has finished. */
  completeDescent: () => void;
  /** Back to the globe, framing the south polar region. */
  exitTerrain: () => void;
}

function windowFrom(nowMs: number) {
  const start = Math.floor(nowMs / MINUTE_MS) * MINUTE_MS;
  return { epochMs: start, windowStartMs: start, windowEndMs: start + DEFAULT_WINDOW_MS };
}

export const useMissionStore = create<MissionState>()((set, get) => ({
  epochMs: null,
  windowStartMs: null,
  windowEndMs: null,
  playing: false,
  rate: 3_600,
  selectedSiteId: null,
  defaultSiteApplied: false,
  view: { preset: "south-polar", requestId: 0 },
  scene: "globe",
  sceneTransition: "idle",
  layers: { graticule: true, sites: true, labels: true },

  initializeTime: (nowMs) => {
    if (get().epochMs === null) set(windowFrom(nowMs));
  },
  resetToNow: (nowMs) => set({ ...windowFrom(nowMs), playing: false }),
  setEpoch: (ms) => {
    const { windowStartMs, windowEndMs } = get();
    if (windowStartMs === null || windowEndMs === null) return;
    set({ epochMs: clamp(ms, windowStartMs, windowEndMs) });
  },
  stepEpoch: (deltaMs) => {
    const { epochMs } = get();
    if (epochMs !== null) get().setEpoch(epochMs + deltaMs);
  },
  setPlaying: (playing) => {
    const { epochMs, windowEndMs } = get();
    // Restart from the window start when play is pressed at the end.
    if (playing && epochMs !== null && windowEndMs !== null && epochMs >= windowEndMs) {
      set({ epochMs: get().windowStartMs, playing });
      return;
    }
    set({ playing });
  },
  setRate: (rate) => set({ rate: rate > 0 ? rate : get().rate }),
  advance: (realElapsedMs) => {
    const { playing, epochMs, windowEndMs, rate } = get();
    if (!playing || epochMs === null || windowEndMs === null || realElapsedMs <= 0) return;
    const next = epochMs + realElapsedMs * rate;
    if (next >= windowEndMs) set({ epochMs: windowEndMs, playing: false });
    else set({ epochMs: next });
  },
  selectSite: (selectedSiteId) => set({ selectedSiteId }),
  applyDefaultSite: (siteId) => {
    if (get().defaultSiteApplied) return;
    set(
      get().selectedSiteId === null && siteId !== null
        ? { defaultSiteApplied: true, selectedSiteId: siteId }
        : { defaultSiteApplied: true },
    );
  },
  requestView: (preset) => set({ view: { preset, requestId: get().view.requestId + 1 } }),
  toggleLayer: (layer) => set({ layers: { ...get().layers, [layer]: !get().layers[layer] } }),
  enterTerrain: () => {
    const { scene, sceneTransition, view } = get();
    if (scene === "terrain" || sceneTransition === "descending") return;
    set({
      sceneTransition: "descending",
      view: { preset: "south-pole", requestId: view.requestId + 1, distance: TERRAIN_DESCENT_DISTANCE },
    });
  },
  completeDescent: () => {
    if (get().sceneTransition === "descending") set({ scene: "terrain", sceneTransition: "idle" });
  },
  exitTerrain: () => {
    const { view } = get();
    set({
      scene: "globe",
      sceneTransition: "idle",
      view: { preset: "south-polar", requestId: view.requestId + 1 },
    });
  },
}));
