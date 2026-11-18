"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cachedPackLoad, getLessonPack } from "@/lib/lesson/pack";
import type { LessonPack } from "@/lib/lesson/types";

export type PackState =
  { status: "loading" } | { status: "ready"; pack: LessonPack } | { status: "error"; message: string };

/** Loads the lesson pack (static files, never the API). `reload` retries after an error. */
export function useLessonPack(): { state: PackState; reload: () => void } {
  const [state, setState] = useState<PackState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getLessonPack().then(
      (pack) => {
        if (!cancelled) setState({ status: "ready", pack });
      },
      (error: unknown) => {
        if (!cancelled)
          setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);
  return { state, reload };
}

export type ResourceState<T> =
  { status: "loading" } | { status: "ready"; data: T } | { status: "error"; message: string };

/** Loads one pack resource (a site, a comparison) by key; static files only, never the API. */
export function usePackResource<T>(
  key: string,
  load: () => Promise<T>,
): { state: ResourceState<T>; reload: () => void } {
  const [state, setState] = useState<{ key: string; value: ResourceState<T> }>({
    key,
    value: { status: "loading" },
  });
  const [attempt, setAttempt] = useState(0);
  // The loader is identified by `key`; callers pass a closure over the same key every time.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let cancelled = false;
    cachedPackLoad(`${key}#${attempt}`, () => loadRef.current()).then(
      (data) => {
        if (!cancelled) setState({ key, value: { status: "ready", data } });
      },
      (error: unknown) => {
        if (!cancelled)
          setState({
            key,
            value: { status: "error", message: error instanceof Error ? error.message : String(error) },
          });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key, attempt]);

  const reload = useCallback(() => {
    setState({ key, value: { status: "loading" } });
    setAttempt((n) => n + 1);
  }, [key]);
  // A different key shows "loading" until its own load finishes, never the previous key's data.
  return { state: state.key === key ? state.value : { status: "loading" }, reload };
}
