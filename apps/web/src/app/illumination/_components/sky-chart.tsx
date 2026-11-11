"use client";

import type { Data } from "plotly.js";
import { useEffect, useRef, useState } from "react";

import { loadPlotly } from "@/components/timeline/plotly-loader";

import { chartRange, type BodyTrack, type HorizonProfile } from "../_lib/model";

export const SKY_COLORS = {
  sun: "#f0b54a",
  earth: "#7cb5ff",
  terrain: "#a0aec0",
  lowerBound: "#ff7a6b",
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
    const data: Data[] = [];
    if (profile) {
      data.push({
        x: profile.azimuthDeg,
        y: profile.elevationDeg,
        type: "scatter",
        mode: "lines",
        line: { color: SKY_COLORS.terrain, width: 1 },
        fill: "tozeroy",
        fillcolor: "rgba(160,174,192,0.22)",
        hoverinfo: "skip",
      });
      if (profile.lowerBound.azimuthDeg.length > 0) {
        data.push({
          x: profile.lowerBound.azimuthDeg,
          y: profile.lowerBound.elevationDeg,
          type: "scatter",
          mode: "markers",
          marker: { symbol: "triangle-up", size: 6, color: SKY_COLORS.lowerBound },
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
        marker: { size: 3, color: SKY_COLORS[t.body] },
        error_y: {
          type: "data",
          array: t.radiusDeg,
          visible: true,
          color: `${SKY_COLORS[t.body]}66`,
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
            margin: { l: 40, r: 8, t: 8, b: 32 },
            height: CHART_HEIGHT_PX,
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            showlegend: false,
            font: { family: "ui-monospace, monospace", size: 12, color: "#8a94a6" },
            xaxis: {
              range: [0, 360],
              tickvals: [0, 45, 90, 135, 180, 225, 270, 315, 360],
              ticktext: ["N", "45", "E", "135", "S", "225", "W", "315", "N"],
              gridcolor: "rgba(160,174,192,0.12)",
              zeroline: false,
              fixedrange: true,
              title: { text: "Azimuth (° clockwise from north)", standoff: 4 },
            },
            yaxis: {
              range: [yMin, yMax],
              ticksuffix: "°",
              gridcolor: "rgba(160,174,192,0.12)",
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
                line: { color: "rgba(160,174,192,0.6)", width: 1, dash: "dot" },
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
      className="relative w-full"
      style={{ height: CHART_HEIGHT_PX }}
      data-testid="sky-chart"
      data-plot-state={state}
      data-lower-bound-count={profile?.lowerBound.azimuthDeg.length ?? 0}
      data-track-count={tracks.length}
    >
      <div ref={ref} className="absolute inset-0" aria-hidden="true" />
      {state === "error" && (
        <span className="absolute inset-0 flex items-center justify-center font-mono text-3xs text-warn">
          Plot unavailable (chart library failed to load)
        </span>
      )}
    </div>
  );
}
