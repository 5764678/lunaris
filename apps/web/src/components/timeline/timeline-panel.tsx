"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Timestamp } from "@/components/time/timestamp";
import { DAY_MS, HOUR_MS, PLAYBACK_RATES } from "@/lib/time/time";
import { describeError } from "@/lib/api/client";
import { useSitesQuery, useSiteEphemeris, useSiteTimeline } from "@/lib/api/queries";
import { fractionSeriesFromTimeline } from "@/lib/timeline/fractions";
import { SeriesError, seriesFromEphemeris } from "@/lib/timeline/series";
import { useMissionStore } from "@/store/mission-store";

import { TimelineTrack, type LaneData } from "./timeline-track";

/** Drives playback with requestAnimationFrame while playing. */
function usePlayback() {
  const playing = useMissionStore((s) => s.playing);
  const advance = useMissionStore((s) => s.advance);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      advance(now - last);
      last = now;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [playing, advance]);
}

function TransportButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon-sm" variant="outline" aria-label={label} onClick={onClick} disabled={disabled}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

export function TimelinePanel() {
  const epochMs = useMissionStore((s) => s.epochMs);
  const startMs = useMissionStore((s) => s.windowStartMs);
  const endMs = useMissionStore((s) => s.windowEndMs);
  const playing = useMissionStore((s) => s.playing);
  const rate = useMissionStore((s) => s.rate);
  const initializeTime = useMissionStore((s) => s.initializeTime);
  const resetToNow = useMissionStore((s) => s.resetToNow);
  const stepEpoch = useMissionStore((s) => s.stepEpoch);
  const setPlaying = useMissionStore((s) => s.setPlaying);
  const setRate = useMissionStore((s) => s.setRate);

  useEffect(() => initializeTime(Date.now()), [initializeTime]);
  usePlayback();
  const ready = epochMs !== null && startMs !== null && endMs !== null;
  const geometry = useGeometryLanes(startMs, endMs);
  const fractions = useFractionLanes(startMs, endMs);
  const { geometryNote, siteName } = geometry;
  const lanes = useMemo(() => ({ ...geometry.lanes, ...fractions.lanes }), [geometry.lanes, fractions.lanes]);

  return (
    <section aria-label="Timeline" className="border-t border-border bg-panel px-5 pt-4 pb-4">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1">
          <TransportButton label="Back 1 day" onClick={() => stepEpoch(-DAY_MS)} disabled={!ready}>
            <ChevronsLeft />
          </TransportButton>
          <TransportButton label="Back 1 hour" onClick={() => stepEpoch(-HOUR_MS)} disabled={!ready}>
            <ChevronLeft />
          </TransportButton>
          <Button
            size="icon-sm"
            variant={playing ? "secondary" : "default"}
            aria-label={playing ? "Pause" : "Play"}
            aria-pressed={playing}
            onClick={() => setPlaying(!playing)}
            disabled={!ready}
            data-testid="timeline-play"
          >
            {playing ? <Pause /> : <Play />}
          </Button>
          <TransportButton label="Forward 1 hour" onClick={() => stepEpoch(HOUR_MS)} disabled={!ready}>
            <ChevronRight />
          </TransportButton>
          <TransportButton label="Forward 1 day" onClick={() => stepEpoch(DAY_MS)} disabled={!ready}>
            <ChevronsRight />
          </TransportButton>
          <Button
            size="sm"
            variant="outline"
            className="ml-1"
            onClick={() => resetToNow(Date.now())}
            disabled={!ready}
          >
            <RotateCcw /> Now
          </Button>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="label-caps">Selected time</span>
          <span className="numeric font-mono text-base text-foreground" data-testid="timeline-epoch">
            {ready ? <Timestamp ms={epochMs} seconds /> : "-- --- ---- --:--:--"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="label-caps" title="How much time passes on the timeline for every real second">
            Speed (per second)
          </span>
          <ToggleGroup
            type="single"
            value={String(rate)}
            onValueChange={(value) => value && setRate(Number(value))}
            aria-label="Playback speed: simulated time per real second"
          >
            {PLAYBACK_RATES.map((r) => (
              <ToggleGroupItem key={r.value} value={String(r.value)}>
                {r.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>
      <TimelineTrack lanes={lanes} geometryNote={geometryNote} fractionNote={fractions.note} />
      <p className="mt-2 text-3xs text-dim" data-testid="timeline-note">
        {siteName
          ? `Sun and Earth lanes: how high each one appears above a level horizon at ${siteName}. The dashed line is that level horizon and the band is the width of the Sun or Earth. Sunlight and Earth line-of-sight lanes: how much of the disk is above the skyline. The solid line includes the terrain around the site; the dotted line ("no hills") assumes a smooth Moon. Line of sight is geometry only and does not imply a radio link.`
          : "Select a candidate site to see how high the Sun and Earth appear above its horizon over this window."}
      </p>
      {siteName && (
        <details className="mt-1 text-3xs text-dim" data-testid="timeline-method">
          <summary className="w-fit cursor-pointer">Method</summary>
          <p className="mt-1">
            Directions come from NASA&apos;s SPICE toolkit: the apparent direction, corrected for the time
            light takes to travel and for the small shift in direction caused by motion. Heights are measured
            above the local horizontal plane of the 1,737.4 km reference sphere, sampled hourly. The skyline
            comes from a terrain horizon mask where one is available.
          </p>
        </details>
      )}
    </section>
  );
}

/** Sun/Earth elevation lanes for the selected site (C2), or the reason they are empty. */
function useGeometryLanes(startMs: number | null, endMs: number | null) {
  const selectedSiteId = useMissionStore((s) => s.selectedSiteId);
  const site = useSitesQuery().data?.sites.find((s) => s.id === selectedSiteId) ?? null;
  const query = useSiteEphemeris(site?.id ?? null, startMs, endMs);
  return useMemo((): { lanes: LaneData; geometryNote: string; siteName: string | null } => {
    if (!site) return { lanes: {}, geometryNote: "Not computed · select a site", siteName: null };
    if (query.isError) {
      return { lanes: {}, geometryNote: `Not computed · ${describeError(query.error)}`, siteName: site.name };
    }
    if (!query.data) {
      return { lanes: {}, geometryNote: "Loading Sun and Earth positions…", siteName: site.name };
    }
    try {
      return { lanes: seriesFromEphemeris(query.data), geometryNote: "", siteName: site.name };
    } catch (error) {
      const reason = error instanceof SeriesError ? error.message : "invalid ephemeris";
      return { lanes: {}, geometryNote: `Not computed · ${reason}`, siteName: site.name };
    }
  }, [site, query.isError, query.error, query.data]);
}

/** Illumination and Earth line-of-sight lanes (C4) for the selected site, or why they are empty. */
function useFractionLanes(startMs: number | null, endMs: number | null) {
  const selectedSiteId = useMissionStore((s) => s.selectedSiteId);
  const site = useSitesQuery().data?.sites.find((s) => s.id === selectedSiteId) ?? null;
  const query = useSiteTimeline(site?.id ?? null, startMs, endMs);
  return useMemo((): { lanes: LaneData; note: string } => {
    if (!site) return { lanes: {}, note: "Not computed · select a site" };
    if (query.isError) return { lanes: {}, note: `Not computed · ${describeError(query.error)}` };
    if (!query.data) return { lanes: {}, note: "Loading sunlight and Earth visibility…" };
    try {
      const { illumination, los } = fractionSeriesFromTimeline(query.data);
      return { lanes: { illumination, los }, note: "" };
    } catch (error) {
      return {
        lanes: {},
        note: `Not computed · ${error instanceof SeriesError ? error.message : "invalid timeline"}`,
      };
    }
  }, [site, query.isError, query.error, query.data]);
}
