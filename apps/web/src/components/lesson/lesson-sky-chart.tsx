"use client";

import type { Data } from "plotly.js";
import { useEffect, useRef, useState } from "react";

import { chartRange, type BodyTrack, type HorizonProfile } from "@/app/illumination/_lib/model";
import { loadPlotly } from "@/components/timeline/plotly-loader";
import { useT } from "@/lib/i18n";
import { readToken } from "@/lib/theme/tokens";

/** Chart text, in px. The lesson minimum is 14 px. */
const FONT_PX = 14;
const CHART_HEIGHT_PX = 320;

/**
 * The sky chart for the lesson route: the same drawing as the Explorer's chart (terrain
 * skyline, lower-bound triangles, the 0° line, the Sun and Earth tracks), built from the
 * same view-model helpers, with the axis text from the Thai/English catalogue and 14 px
 * chart text. The chart is a dark "window into space" (decision D14); colours are tokens.
 */
export function LessonSkyChart({ profile, tracks }: { profile: HorizonProfile; tracks: BodyTrack[] }) {
  const t = useT().learn.stand;
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let cancelled = false;
    const [yMin, yMax] = chartRange(profile, tracks);
    const colours = {
      sun: readToken("chart-sun", node),
      earth: readToken("chart-earth", node),
    };
    const data: Data[] = [
      {
        x: profile.azimuthDeg,
        y: profile.elevationDeg,
        type: "scatter",
        mode: "lines",
        line: { color: readToken("chart-terrain", node), width: 1 },
        fill: "tozeroy",
        fillcolor: readToken("chart-terrain-fill", node),
        hoverinfo: "skip",
      },
    ];
    if (profile.lowerBound.azimuthDeg.length > 0) {
      data.push({
        x: profile.lowerBound.azimuthDeg,
        y: profile.lowerBound.elevationDeg,
        type: "scatter",
        mode: "markers",
        marker: { symbol: "triangle-up", size: 7, color: readToken("chart-lower-bound", node) },
        hoverinfo: "skip",
      });
    }
    for (const track of tracks) {
      const colour = colours[track.body];
      data.push({
        x: track.azimuthDeg,
        y: track.elevationDeg,
        type: "scatter",
        mode: "markers",
        marker: { size: 4, color: colour },
        error_y: {
          type: "data",
          array: track.radiusDeg,
          visible: true,
          color: `${colour}66`,
          thickness: 1,
          width: 0,
        },
        hoverinfo: "skip",
      });
    }
    const grid = readToken("chart-grid", node);
    loadPlotly()
      .then((Plotly) => {
        if (cancelled) return;
        return Plotly.react(
          node,
          data,
          {
            margin: { l: 52, r: 10, t: 8, b: 64 },
            height: CHART_HEIGHT_PX,
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            showlegend: false,
            font: { size: FONT_PX, color: readToken("muted-foreground", node) },
            xaxis: {
              range: [0, 360],
              tickvals: [0, 90, 180, 270, 360],
              ticktext: [t.compass.n, t.compass.e, t.compass.s, t.compass.w, t.compass.n],
              gridcolor: grid,
              zeroline: false,
              fixedrange: true,
              title: { text: t.azimuthAxis, standoff: 6, font: { size: FONT_PX } },
            },
            yaxis: {
              range: [yMin, yMax],
              ticksuffix: "°",
              gridcolor: grid,
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
  }, [profile, tracks, t]);

  useEffect(() => {
    const node = ref.current;
    return () => {
      if (node) void loadPlotly().then((Plotly) => Plotly.purge(node));
    };
  }, []);

  return (
    <div
      role="img"
      aria-label={t.chartLabel}
      className="space relative w-full overflow-hidden rounded-md border border-border bg-panel"
      style={{ height: CHART_HEIGHT_PX }}
      data-testid="lesson-sky-chart"
      data-plot-state={state}
      data-track-count={tracks.length}
      data-lower-bound-count={profile.lowerBound.azimuthDeg.length}
    >
      <div ref={ref} className="absolute inset-0" aria-hidden="true" />
      {state === "error" && (
        <span className="absolute inset-0 flex items-center justify-center p-3 text-center text-sm text-warn">
          {t.chartError}
        </span>
      )}
    </div>
  );
}
