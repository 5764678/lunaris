"use client";

import type { Data } from "plotly.js";
import { useEffect, useRef, useState } from "react";

import { loadPlotly } from "@/components/timeline/plotly-loader";
import { readToken } from "@/lib/theme/tokens";

import { chartRange, type BodyTrack, type HorizonProfile } from "../_lib/model";

/** Token names of the chart colours. The chart is a dark "space" window, so these resolve to the dark values. */
const SKY_TOKENS = {
  sun: "chart-sun",
  earth: "chart-earth",
  terrain: "chart-terrain",
  lowerBound: "chart-lower-bound",
} as const;

/** The same colours as CSS values, for the legend, which sits inside a `space` window too. */
export const SKY_COLORS = {
  sun: "var(--chart-sun)",
  earth: "var(--chart-earth)",
  terrain: "var(--chart-terrain)",
  lowerBound: "var(--chart-lower-bound)",
} as const;

const CHART_HEIGHT_PX = 280;

/**
 * Azimuth–elevation sky chart: the terrain skyline (T-16) as a filled profile, azimuths
 * whose ray left DEM coverage as up-triangles (lower bounds), the astronomical horizon
 * (0°) dashed, and the Sun and Earth tracks over the window as centre points with a bar
 * of ± the apparent angular radius (the disk's height). Static plot: the numbers are in
 * the evidence cells beside it, not in hover labels.
 */
export function SkyChart({ profile, tracks }: { profile: HorizonProfile | null; tracks: BodyTrack[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let cancelled = false;
    const [yMin, yMax] = chartRange(profile, tracks);
    const c = (name: keyof typeof SKY_TOKENS) => readToken(SKY_TOKENS[name], node);
    const data: Data[] = [];
    if (profile) {
      data.push({
        x: profile.azimuthDeg,
        y: profile.elevationDeg,
        type: "scatter",
        mode: "lines",
        line: { color: c("terrain"), width: 1 },
        fill: "tozeroy",
        fillcolor: readToken("chart-terrain-fill", node),
        hoverinfo: "skip",
      });
      if (profile.lowerBound.azimuthDeg.length > 0) {
        data.push({
          x: profile.lowerBound.azimuthDeg,
          y: profile.lowerBound.elevationDeg,
          type: "scatter",
          mode: "markers",
          marker: { symbol: "triangle-up", size: 6, color: c("lowerBound") },
          hoverinfo: "skip",
        });
      }
    }
    for (const t of tracks) {
      data.push({
        x: t.azimuthDeg,
        y: t.elevationDeg,
        type: "scatter",
        mode: "markers",
        marker: { size: 3, color: c(t.body) },
        error_y: {
          type: "data",
          array: t.radiusDeg,
          visible: true,
          color: `${c(t.body)}66`,
          thickness: 1,
          width: 0,
        },
        hoverinfo: "skip",
      });
    }

    loadPlotly()
      .then((Plotly) => {
        if (cancelled) return;
        return Plotly.react(
          node,
          data,
          {
            margin: { l: 40, r: 8, t: 8, b: 46 },
            height: CHART_HEIGHT_PX,
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            showlegend: false,
            font: { family: "ui-monospace, monospace", size: 13, color: readToken("muted-foreground", node) },
            xaxis: {
              range: [0, 360],
              tickvals: [0, 45, 90, 135, 180, 225, 270, 315, 360],
              ticktext: ["N", "45", "E", "135", "S", "225", "W", "315", "N"],
              gridcolor: readToken("chart-grid", node),
              zeroline: false,
              fixedrange: true,
              title: { text: "Azimuth (° clockwise from north)", standoff: 4 },
            },
            yaxis: {
              range: [yMin, yMax],
              ticksuffix: "°",
              gridcolor: readToken("chart-grid", node),
              zeroline: false,
              fixedrange: true,
            },
            shapes: [
              {
                type: "line",
                xref: "paper",
                x0: 0,
                x1: 1,
                y0: 0,
                y1: 0,
                line: { color: readToken("chart-reference", node), width: 1, dash: "dot" },
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
  }, [profile, tracks]);

  useEffect(() => {
    const node = ref.current;
    return () => {
      if (node) void loadPlotly().then((Plotly) => Plotly.purge(node));
    };
  }, []);

  return (
    <div
      className="space relative w-full rounded-md border border-border bg-panel"
      style={{ height: CHART_HEIGHT_PX }}
      data-testid="sky-chart"
      data-plot-state={state}
      data-lower-bound-count={profile?.lowerBound.azimuthDeg.length ?? 0}
      data-track-count={tracks.length}
    >
      <div ref={ref} className="absolute inset-0" aria-hidden="true" />
      {state === "error" && (
        <span className="absolute inset-0 flex items-center justify-center text-3xs text-warn">
          Plot unavailable (chart library failed to load)
        </span>
      )}
    </div>
  );
}
