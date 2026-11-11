import { create } from "zustand";

export type ZoneMode = "utc" | "local";

const KEY = "lunaris.timeZoneMode";

function load(): ZoneMode {
  try {
    return window.localStorage.getItem(KEY) === "local" ? "local" : "utc";
  } catch {
    return "utc";
  }
}

interface ZoneState {
  mode: ZoneMode;
  setMode: (mode: ZoneMode) => void;
}

/**
 * Which zone the time tables show. UTC is the default and the standard for space work; the
 * choice is remembered in the browser when storage is available, and the app works without it.
 * The stored value is read after hydration (see `useZoneMode`), never during server rendering.
 */
export const useZoneStore = create<ZoneState>((set) => ({
  mode: "utc",
  setMode: (mode) => {
    set({ mode });
    try {
      window.localStorage.setItem(KEY, mode);
    } catch {
      /* storage blocked: the choice lasts until the page is closed */
    }
  },
}));

/** Called once on the client after hydration to restore the remembered choice. */
export function restoreZoneMode(): void {
  useZoneStore.setState({ mode: load() });
}
