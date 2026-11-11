"use client";

import { useEffect, useRef, useState } from "react";

import type { ElevationSeries } from "@/lib/timeline/series";
import { elevationRange } from "@/lib/timeline/series";

import { loadPlotly } from "./plotly-loader";

export const ELEVATION_LANE_HEIGHT_PX = 64;

const COLORS = { sun: "#f0b54a", earth: "#7cb5ff" } as const;

/**
 * Elevation of one body over the timeline window, drawn with Plotly as a static plot
 * (no Plotly interaction), so pointer and keyboard input keep going to the epoch slider
 * that contains it. The band is the body's disk (centre ± angular radius); the dashed
 * line is the astronomical horizon (0°, C0 plane). The terrain horizon is not drawn
 * here: it belongs to the illumination and line-of-sight lanes (T-24).
 */
export function ElevationLane({
  series,
  startMs,
  endMs,
}: {
  series: ElevationSeries;
  startMs: number;
  endMs: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let cancelled = false;
    const color = COLORS[series.body];
    const [yMin, yMax] = elevationRange(series);
    const x = series.epochsMs.map((ms) => new Date(ms));
    const upper = series.elevationDeg.map((e, i) => e + series.angularRadiusDeg[i]!);
    const lower = series.elevationDeg.map((e, i) => e - series.angularRadiusDeg[i]!);

    loadPlotly()
      .then((Plotly) => {
        if (cancelled) return;
        return Plotly.react(
          node,
          [
            { x, y: lower, type: "scatter", mode: "lines", line: { width: 0 }, hoverinfo: "skip" },
            {
              x,
              y: upper,
              type: "scatter",
              mode: "lines",
              line: { width: 0 },
              fill: "tonexty",
              fillcolor: `${color}33`,
              hoverinfo: "skip",
            },
            { x, y: series.elevationDeg, type: "scatter", mode: "lines", line: { color, width: 1.25 } },
          ],
          {
            margin: { l: 0, r: 0, t: 0, b: 0 },
            height: ELEVATION_LANE_HEIGHT_PX,
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            showlegend: false,
            xaxis: {
              type: "date",
              range: [new Date(startMs), new Date(endMs)],
              visible: false,
              fixedrange: true,
            },
            yaxis: { range: [yMin, yMax], visible: false, fixedrange: true },
            shapes: [
              {
                type: "line",
                xref: "paper",
                x0: 0,
                x1: 1,
                y0: 0,
                y1: 0,
                line: { color: "rgba(160,174,192,0.55)", width: 1, dash: "dot" },
              },
            ],
          },
          { staticPlot: true, displayModeBar: false, responsive: true },
        );
      })
      .then(() => {
        if (!cancelled) setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [series, startMs, endMs]);

  useEffect(() => {
    const node = ref.current;
    return () => {
      if (node) void loadPlotly().then((Plotly) => Plotly.purge(node));
    };
  }, []);

  const [, yMax] = elevationRange(series);
  return (
    <div className="relative h-full w-full" data-plot-state={state}>
      <div ref={ref} className="absolute inset-0" aria-hidden="true" />
      {state === "ready" && (
        <>
          <span className="pointer-events-none absolute top-0.5 right-1 font-mono text-[9px] leading-none text-dim">
            +{yMax.toFixed(1)}°
          </span>
          <span className="pointer-events-none absolute top-1/2 right-1 -translate-y-1/2 font-mono text-[9px] leading-none text-dim">
            0°
          </span>
          <span className="pointer-events-none absolute right-1 bottom-0.5 font-mono text-[9px] leading-none text-dim">
            −{yMax.toFixed(1)}°
          </span>
        </>
      )}
      {state === "error" && (
        <span className="absolute inset-0 flex items-center justify-center font-mono text-3xs text-warn">
          Plot unavailable (chart library failed to load)
        </span>
      )}
    </div>
  );
}
