"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { PERIODS, stepHref, stepKey, type Period } from "./steps";

/** The six-step navigation: one link per period, the current one marked. */
export function StepList({ current, wrap = false }: { current: Period | null; wrap?: boolean }) {
  const t = useT().learn;
  return (
    <nav aria-label={t.stepNavLabel} data-testid="step-nav">
      <ol
        className={
          wrap
            ? "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6"
            : "grid grid-cols-3 gap-2 sm:grid-cols-6"
        }
      >
        {PERIODS.map((p) => {
          const step = t.steps[stepKey(p)];
          const active = p === current;
          return (
            <li key={p}>
              <Link
                href={stepHref(p)}
                aria-current={active ? "step" : undefined}
                data-testid={`step-link-${p}`}
                title={step.title}
                className={cn(
                  "flex min-h-14 flex-col justify-center rounded-md border px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                  active
                    ? "border-primary bg-accent text-foreground"
                    : "border-border bg-panel text-muted-foreground hover:border-border-strong hover:text-foreground",
                )}
              >
                <span className="font-semibold">{t.period(p)}</span>
                <span className={cn("text-sm", wrap ? "lg:truncate" : "truncate")}>{step.phase}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Previous and next step, and a way back to the list of steps. */
export function StepPager({ period }: { period: Period }) {
  const t = useT().learn;
  const link =
    "inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-panel px-4 text-sm text-foreground outline-none hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring/60";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-4">
      {period > 1 ? (
        <Link href={stepHref((period - 1) as Period)} className={link} data-testid="step-prev">
          <ChevronLeft className="size-4" aria-hidden="true" />
          {t.previous}
        </Link>
      ) : (
        <span />
      )}
      <Link href="/learn" className={cn(link, "border-transparent bg-transparent text-muted-foreground")}>
        {t.allSteps}
      </Link>
      {period < 6 ? (
        <Link href={stepHref((period + 1) as Period)} className={link} data-testid="step-next">
          {t.next}
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
