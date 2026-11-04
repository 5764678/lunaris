"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DAY_MS, HOUR_MS, PLAYBACK_RATES, formatOffset, formatUtc } from "@/lib/time/time";
import { useMissionStore } from "@/store/mission-store";

import { TimelineTrack } from "./timeline-track";

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

  return (
    <section aria-label="Timeline" className="border-t border-border bg-panel px-4 pt-2.5 pb-3">
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
          <span className="label-caps">Epoch</span>
          <span className="numeric font-mono text-sm text-foreground" data-testid="timeline-epoch">
            {ready ? formatUtc(epochMs) : "----------  --:--:--"}
          </span>
          <span className="font-mono text-3xs text-dim">UTC</span>
          {ready && (
            <span className="numeric font-mono text-2xs text-muted-foreground">
              T{formatOffset(epochMs - startMs)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="label-caps">Rate</span>
          <ToggleGroup
            type="single"
            value={String(rate)}
            onValueChange={(value) => value && setRate(Number(value))}
            aria-label="Playback rate"
          >
            {PLAYBACK_RATES.map((r) => (
              <ToggleGroupItem key={r.value} value={String(r.value)}>
                {r.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>
      <TimelineTrack />
      <p className="mt-2 text-3xs text-dim">
        The epoch is the analysis time for future geometry modules. No time series is computed in Milestone
        01; the lanes above are intentionally empty.
      </p>
    </section>
  );
}
