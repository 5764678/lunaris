"use client";

import type PlotlyType from "plotly.js";

export type Plotly = typeof PlotlyType;

let pending: Promise<Plotly> | null = null;

/**
 * Loads Plotly on first use (dynamic import), so the ~1 MB basic bundle is only fetched
 * when a lane actually has computed data to draw. The promise is shared by all lanes.
 */
export function loadPlotly(): Promise<Plotly> {
  pending ??= import("plotly.js-basic-dist-min").then((module) => module.default as Plotly);
  pending.catch(() => {
    pending = null; // allow a retry after a failed chunk load
  });
  return pending;
}
