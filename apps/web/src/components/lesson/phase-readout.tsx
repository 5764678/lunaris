"use client";

import { useT } from "@/lib/i18n";
import { readoutFor } from "@/lib/lesson/phase";
import type { MoonPhaseSample } from "@/lib/lesson/types";

/**
 * Percent lit, waxing or waning, the phase name, and the note that the view is geocentric
 * (decision D12). It says nothing about moonrise or tides: the app does not compute them.
 */
export function PhaseReadout({ sample }: { sample: MoonPhaseSample }) {
  const t = useT().learn.earth;
  const readout = readoutFor(sample);
  return (
    <section aria-label={t.heading} data-testid="phase-readout" className="space-y-3">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-muted-foreground">{t.percentLit}</dt>
          <dd data-testid="percent-lit" className="numeric text-2xl font-semibold text-foreground">
            {t.percentValue(readout.percentLit)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.direction}</dt>
          <dd
            data-testid="waxing-waning"
            data-waxing={readout.waxing}
            className="font-medium text-foreground"
          >
            {readout.waxing ? t.waxing : t.waning}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground">{t.phaseName}</dt>
          <dd
            data-testid="phase-name"
            data-phase={readout.name}
            className="text-lg font-semibold text-foreground"
          >
            {t.phases[readout.name]}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.phaseAngle}</dt>
          <dd className="numeric text-foreground">{t.degrees(readout.phaseAngleDeg)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.elongation}</dt>
          <dd className="numeric text-foreground">{t.degrees(readout.elongationDeg)}</dd>
        </div>
      </dl>
      <p
        data-testid="geocentric-note"
        className="rounded-md border border-border bg-panel-sunken p-2.5 text-sm leading-relaxed text-foreground"
      >
        {t.viewNote}
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">{t.bandsNote}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">{t.calendarNote}</p>
    </section>
  );
}
