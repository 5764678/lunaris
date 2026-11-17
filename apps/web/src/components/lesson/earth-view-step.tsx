"use client";

import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";

import { useSurfaceSource } from "@/components/viewport/surface-source";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { frameAt, indexSunByEpoch, samplesPerDay, totalDays } from "@/lib/lesson/series";
import type { LessonPack } from "@/lib/lesson/types";

import { EvidenceFold, PackBanner } from "./pack-provenance";
import { PhaseReadout } from "./phase-readout";
import { useLessonPack } from "./use-lesson-pack";

/** Lesson buttons: 14 px text and a 44 px touch target. */
const BTN = "h-11 px-4 text-sm";

const EarthViewCanvas = dynamic(() => import("./earth-view-canvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse" aria-hidden="true" />,
});

/** Period 2 (K-04 part): the Moon from the Earth's centre, stepped through one lunation. */
export function EarthViewStep() {
  const t = useT().learn;
  const { state, reload } = useLessonPack();

  if (state.status === "loading") {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {t.pack.loading}
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <div role="alert" className="space-y-2 rounded-md border border-critical p-3 text-sm">
        <p className="font-medium text-critical">{t.pack.error}</p>
        <p lang="en" className="text-muted-foreground">
          {state.message}
        </p>
        <Button type="button" variant="outline" className={BTN} onClick={reload}>
          {t.pack.retry}
        </Button>
      </div>
    );
  }
  return <EarthViewLesson pack={state.pack} />;
}

function EarthViewLesson({ pack }: { pack: LessonPack }) {
  const t = useT().learn;
  const e = t.earth;
  const [index, setIndex] = useState(0);
  const [surfaceFailed, setSurfaceFailed] = useState<string | null>(null);
  const surfaceSource = useSurfaceSource();
  const surface = surfaceFailed ? { kind: "procedural" as const, reason: surfaceFailed } : surfaceSource;
  const sunByEpoch = useMemo(() => indexSunByEpoch(pack), [pack]);
  const frame = useMemo(() => frameAt(pack, index, sunByEpoch), [pack, index, sunByEpoch]);

  const perDay = samplesPerDay(pack.phase.step_s);
  const last = pack.phase.samples.length - 1;
  const days = totalDays(pack);
  const onError = useCallback((reason: string) => setSurfaceFailed(reason), []);
  const onLoaded = useCallback(() => undefined, []);

  if (!frame) {
    return (
      <p role="alert" className="text-sm text-critical">
        {t.pack.error}
      </p>
    );
  }
  const epoch = frame.phase.epoch_utc.slice(0, 16).replace("T", " ");

  return (
    <div className="space-y-4">
      <PackBanner provenance={pack.provenance} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-3">
          <div
            data-testid="earth-view"
            className="relative mx-auto aspect-square w-full max-w-[min(100%,30rem)] overflow-hidden rounded-md border border-border bg-panel-sunken"
          >
            {surface.kind !== "resolving" && (
              <EarthViewCanvas
                surface={surface}
                sunDirectionMoonMe={frame.sunDirectionMoonMe}
                earthDirectionMoonMe={frame.phase.earth_direction_moon_me}
                onSurfaceError={onError}
                onSurfaceLoaded={onLoaded}
                label={e.viewLabel}
              />
            )}
          </div>
          <p data-testid="surface-note" className="text-sm leading-relaxed text-muted-foreground">
            {surface.kind === "texture" ? surface.manifest.credit : e.surfacePlaceholder}
          </p>

          <div className="space-y-2 rounded-md border border-border bg-panel p-3">
            <p data-testid="day-label" className="text-sm font-medium text-foreground">
              {e.day(frame.day, days)}
            </p>
            <p className="numeric text-sm text-muted-foreground">
              {e.dateLabel}: <span data-testid="epoch">{epoch}</span>
            </p>
            <input
              type="range"
              min={0}
              max={last}
              step={1}
              value={frame.index}
              onChange={(event) => setIndex(Number(event.target.value))}
              aria-label={e.slider}
              data-testid="lunation-slider"
              className="h-8 w-full accent-primary"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className={BTN}
                data-testid="step-back"
                disabled={frame.index <= 0}
                onClick={() => setIndex(Math.max(0, frame.index - perDay))}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                {e.prevDay}
              </Button>
              <Button
                type="button"
                variant="outline"
                className={BTN}
                data-testid="step-forward"
                disabled={frame.index >= last}
                onClick={() => setIndex(Math.min(last, frame.index + perDay))}
              >
                {e.nextDay}
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={BTN}
                data-testid="step-restart"
                onClick={() => setIndex(0)}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                {e.restart}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <PhaseReadout sample={frame.phase} />
          <EvidenceFold evidence={pack.phase.evidence} limitations={pack.phase.limitations} />
        </div>
      </div>
    </div>
  );
}
