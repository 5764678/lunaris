import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * `false` during server rendering and hydration, `true` afterwards.
 *
 * React uses the server snapshot while hydrating, so components can render exactly what
 * the server rendered and switch to client-only state in the post-hydration render —
 * without effects and without hydration mismatches.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
