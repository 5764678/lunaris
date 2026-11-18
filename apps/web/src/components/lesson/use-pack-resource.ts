"use client";

import { useCallback, useEffect, useState } from "react";

export type ResourceState<T> =
  { status: "loading" } | { status: "ready"; value: T } | { status: "error"; message: string };

/**
 * Loads one thing from the lesson pack (static files, never the API). `load` must be stable
 * (wrap it in `useCallback`); `reload` retries after an error.
 */
export function usePackResource<T>(load: () => Promise<T>): { state: ResourceState<T>; reload: () => void } {
  const [state, setState] = useState<ResourceState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load().then(
      (value) => {
        if (!cancelled) setState({ status: "ready", value });
      },
      (error: unknown) => {
        if (!cancelled)
          setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [load, attempt]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);
  return { state, reload };
}
