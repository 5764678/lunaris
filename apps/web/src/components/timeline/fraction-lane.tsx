"use client";

import { useEffect, useRef, useState } from "react";

import type { FractionSeries } from "@/lib/timeline/fractions";

import { ELEVATION_LANE_HEIGHT_PX } from "./elevation-lane";
import { readToken } from "@/lib/theme/tokens";

import { loadPlotly } from "./plotly-loader";

const TOKENS = { illumination: "chart-sun", los: "chart-earth" } as const;

/**
 * Visible-disk fraction (0–100 %) over the window, as a static Plotly plot: the
 * astronomical horizon dotted, the terrain horizon solid with gaps where it is null
 * (no mask value — never drawn as 0). Without any terrain values the lane says so.
 */
export function FractionLane({
  series,
  startMs,
  endMs,
}: {
  series: FractionSeries;
  startMs: number;
  endMs: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let cancelled = false;
    const color = readToken(TOKENS[series.lane], node);
    const x = series.epochsMs.map((ms) => new Date(ms));
    const traces: Partial<Plotly.ScatterData>[] = [
      {
        x,
        y: series.astronomical,
        type: "scatter",
        mode: "lines",
        line: { color: readToken("chart-reference", node), width: 1, dash: "dot" },
      },
    ];
    if (series.terrainAvailable) {
      traces.push({
        x,
        y: series.terrain,
        type: "scatter",
        mode: "lines",
        connectgaps: false,
        fill: "tozeroy",
        fillcolor: `${color}26`,
        line: { color, width: 1.25 },
      });
    }
    loadPlotly()
      .then((Plotly) => {
        if (cancelled) return;
        return Plotly.react(
          node,
          traces as Plotly.Data[],
          {
            margin: { l: 0, r: 0, t: 2, b: 2 },
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
            yaxis: { range: [-0.02, 1.02], visible: false, fixedrange: true },
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

  return (
    <div className="relative h-full w-full" data-plot-state={state}>
      <div ref={ref} className="absolute inset-0" aria-hidden="true" />
      {state === "ready" && (
        <>
          <span className="pointer-events-none absolute top-0.5 right-1 font-mono text-3xs leading-none text-dim">
            100 %
          </span>
          <span className="pointer-events-none absolute right-1 bottom-0.5 font-mono text-3xs leading-none text-dim">
            0 %
          </span>
          {!series.terrainAvailable && (
            <span
              className="pointer-events-none absolute bottom-0.5 left-1 rounded-sm bg-panel-sunken/90 px-1 text-3xs text-dim"
              data-testid={`lane-note-${series.lane}`}
            >
              Terrain horizon not available · astronomical only (dotted)
            </span>
          )}
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
