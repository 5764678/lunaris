"use client";

import { useMemo, useRef, type KeyboardEvent, type PointerEvent } from "react";

import { EvidenceBadge } from "@/components/evidence/evidence-badge";
import { DAY_MS, HOUR_MS, dayTicks, formatUtc } from "@/lib/time/time";
import { elevationAt, type ElevationSeries } from "@/lib/timeline/series";
import { useMissionStore } from "@/store/mission-store";

import { ELEVATION_LANE_HEIGHT_PX, ElevationLane } from "./elevation-lane";

export const ANALYSIS_LANES = [
  { id: "sun", label: "Sun elevation", milestone: "M03", note: "SPICE solar geometry" },
  { id: "earth", label: "Earth elevation", milestone: "M03", note: "SPICE Earth geometry" },
  { id: "illumination", label: "Illumination", milestone: "M04", note: "terrain horizon" },
  { id: "los", label: "Earth line of sight", milestone: "M04", note: "terrain-obstructed DTE" },
] as const;

export type LaneId = (typeof ANALYSIS_LANES)[number]["id"];

/** Computed data per lane. Only the Sun and Earth elevation lanes (C2) take data so far. */
export type LaneData = Partial<Record<"sun" | "earth", ElevationSeries>>;

const EMPTY_LANE_HEIGHT_PX = 18;

function laneSeries(data: LaneData, id: LaneId): ElevationSeries | undefined {
  return id === "sun" || id === "earth" ? data[id] : undefined;
}

function formatElevation(deg: number | null): string {
  if (deg === null) return "—";
  return `${deg >= 0 ? "+" : "−"}${Math.abs(deg).toFixed(2)}°`;
}

/**
 * Time axis + analysis lanes with a draggable epoch cursor. Exposed to assistive
 * technology as a slider (arrows ±1 h, PageUp/PageDown ±1 d, Home/End).
 */
export function TimelineTrack({ lanes = {}, geometryNote }: { lanes?: LaneData; geometryNote?: string }) {
  const epochMs = useMissionStore((s) => s.epochMs);
  const startMs = useMissionStore((s) => s.windowStartMs);
  const endMs = useMissionStore((s) => s.windowEndMs);
  const setEpoch = useMissionStore((s) => s.setEpoch);
  const stepEpoch = useMissionStore((s) => s.stepEpoch);
  const setPlaying = useMissionStore((s) => s.setPlaying);
  const trackRef = useRef<HTMLDivElement>(null);

  const ticks = useMemo(
    () => (startMs !== null && endMs !== null ? dayTicks(startMs, endMs) : []),
    [startMs, endMs],
  );
  const ready = epochMs !== null && startMs !== null && endMs !== null;
  const position = ready ? (epochMs - startMs) / (endMs - startMs) : 0;

  function epochAt(clientX: number) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || !ready) return null;
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return startMs + fraction * (endMs - startMs);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!ready) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPlaying(false);
    const ms = epochAt(event.clientX);
    if (ms !== null) setEpoch(ms);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const ms = epochAt(event.clientX);
    if (ms !== null) setEpoch(ms);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!ready) return;
    const actions: Record<string, () => void> = {
      ArrowLeft: () => stepEpoch(-HOUR_MS),
      ArrowRight: () => stepEpoch(HOUR_MS),
      PageDown: () => stepEpoch(-DAY_MS),
      PageUp: () => stepEpoch(DAY_MS),
      Home: () => setEpoch(startMs),
      End: () => setEpoch(endMs),
    };
    const action = actions[event.key];
    if (action) {
      event.preventDefault();
      setPlaying(false);
      action();
    }
  }

  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-2 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-x-3">
      {/* Axis */}
      <div className="label-caps flex h-6 items-end pb-1">Window · 30 d UTC</div>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Analysis epoch"
        aria-valuemin={startMs ?? 0}
        aria-valuemax={endMs ?? 0}
        aria-valuenow={epochMs ?? 0}
        aria-valuetext={epochMs === null ? "not initialized" : `${formatUtc(epochMs)} UTC`}
        data-testid="timeline-track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
        className="relative row-span-5 cursor-ew-resize touch-none select-none rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <div className="relative h-6 border-b border-border">
          {ticks.map((tick) => (
            <div key={tick.ms} className="absolute bottom-0" style={{ left: `${tick.position * 100}%` }}>
              <div className={tick.major ? "h-2.5 w-px bg-border-strong" : "h-1.5 w-px bg-border"} />
              {tick.major && (
                <span
                  className={`numeric absolute bottom-3 whitespace-nowrap font-mono text-3xs text-dim ${
                    tick.position < 0.04
                      ? "translate-x-0"
                      : tick.position > 0.96
                        ? "-translate-x-full"
                        : "-translate-x-1/2"
                  }`}
                >
                  {tick.label}
                </span>
              )}
            </div>
          ))}
        </div>
        {ANALYSIS_LANES.map((lane) => {
          const series = laneSeries(lanes, lane.id);
          if (series && ready) {
            return (
              <div
                key={lane.id}
                data-lane={lane.id}
                data-lane-state="computed"
                className="relative mt-1 overflow-hidden rounded-[3px] border border-hairline bg-panel-sunken/40"
                style={{ height: ELEVATION_LANE_HEIGHT_PX }}
              >
                <ElevationLane series={series} startMs={startMs} endMs={endMs} />
              </div>
            );
          }
          return (
            <div
              key={lane.id}
              data-lane={lane.id}
              data-lane-state="not-computed"
              className="hatch relative mt-1 flex items-center justify-center rounded-[3px] border border-hairline"
              style={{ height: EMPTY_LANE_HEIGHT_PX }}
            >
              <span className="max-w-full truncate rounded-sm bg-panel-sunken/90 px-1.5 font-mono text-3xs uppercase tracking-[0.12em] text-dim">
                {(lane.id === "sun" || lane.id === "earth") && geometryNote
                  ? geometryNote
                  : `Not computed · ${lane.milestone} · ${lane.note}`}
              </span>
            </div>
          );
        })}
        {ready && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 w-px bg-primary shadow-[0_0_6px] shadow-primary/70"
            style={{ left: `${position * 100}%` }}
          >
            <div className="absolute -top-0.5 left-1/2 size-2 -translate-x-1/2 rotate-45 border border-primary bg-background" />
          </div>
        )}
      </div>
      {ANALYSIS_LANES.map((lane) => {
        const series = laneSeries(lanes, lane.id);
        if (series && ready) {
          return (
            <div
              key={lane.id}
              className="mt-1 flex flex-col justify-center gap-0.5 text-2xs text-muted-foreground"
              style={{ height: ELEVATION_LANE_HEIGHT_PX }}
            >
              <span className="flex items-center gap-1.5">
                {lane.label}
                <EvidenceBadge
                  kind={series.evidence.kind}
                  detail={[series.evidence.statement, series.evidence.method].filter(Boolean).join(" · ")}
                />
              </span>
              <span
                className="numeric font-mono text-xs text-foreground"
                data-testid={`lane-readout-${lane.id}`}
              >
                {formatElevation(elevationAt(series, epochMs))}
              </span>
            </div>
          );
        }
        return (
          <div
            key={lane.id}
            className="mt-1 flex items-center text-2xs text-muted-foreground"
            style={{ height: EMPTY_LANE_HEIGHT_PX }}
          >
            {lane.label}
          </div>
        );
      })}
    </div>
  );
}
