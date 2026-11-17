"use client";

import { useCallback, useEffect, useState } from "react";

import { getLessonPack } from "@/lib/lesson/pack";
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
