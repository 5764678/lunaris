"use client";

import { useT } from "@/lib/i18n";

import { CompareStep } from "./compare-step";
import { EarthViewStep } from "./earth-view-step";
import { StepList, StepPager } from "./lesson-nav";
import { SkyStep } from "./sky-step";
import { stepKey, type Period } from "./steps";

type GuidancePeriod = 1 | 3 | 6;

function Guidance({ period }: { period: GuidancePeriod }) {
  const t = useT().learn.guidance;
  const text = t[stepKey(period) as "p1" | "p3" | "p6"];
  return (
    <div className="space-y-4 text-sm leading-relaxed" data-testid={`guidance-${period}`}>
      <section>
        <h3 className="font-semibold text-foreground">{t.goalHeading}</h3>
        <p className="text-muted-foreground">{text.goal}</p>
      </section>
      <section>
        <h3 className="font-semibold text-foreground">{t.doHeading}</h3>
        <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
          {text.steps.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </section>
      <section className="rounded-md border border-border bg-panel p-3">
        <h3 className="font-semibold text-foreground">{t.limitHeading}</h3>
        <p className="text-muted-foreground">{text.limit}</p>
      </section>
    </div>
  );
}

/** One period of the unit: heading, the step navigation, the step's content, previous/next. */
export function LearnStepPage({ period }: { period: Period }) {
  const t = useT().learn;
  const step = t.steps[stepKey(period)];
  return (
    <div
      className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6"
      data-testid="learn-step"
      data-period={period}
    >
      <StepList current={period} />
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">
          {t.stepOf(period, 6)} · {step.phase}
        </p>
        <h1 className="text-2xl font-semibold text-foreground">{step.title}</h1>
      </header>
      {period === 2 ? (
        <EarthViewStep />
      ) : period === 4 ? (
        <SkyStep />
      ) : period === 5 ? (
        <CompareStep />
      ) : (
        <Guidance period={period as GuidancePeriod} />
      )}
      <p className="text-sm text-dim">{t.draftNote}</p>
      <StepPager period={period} />
    </div>
  );
}

/** The list of the six steps, with the unit's one-line aim. */
export function LearnIndexPage() {
  const t = useT().learn;
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6" data-testid="learn-index">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">{t.title}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{t.intro}</p>
      </header>
      <StepList current={null} />
      <p className="text-sm text-dim">{t.draftNote}</p>
    </div>
  );
}
