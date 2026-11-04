"use client";

import { useEffect, useState } from "react";

import { dayOfYearUtc, formatUtc } from "@/lib/time/time";

/** Wall-clock UTC. Renders a placeholder until mounted (no prerendered timestamps). */
export function UtcClock() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex items-baseline gap-2" aria-live="off">
      <span className="label-caps">UTC</span>
      <time
        className="numeric font-mono text-xs text-foreground"
        dateTime={now === null ? undefined : new Date(now).toISOString()}
        suppressHydrationWarning
      >
        {now === null ? "----------  --:--:--" : formatUtc(now)}
      </time>
      <span className="numeric hidden font-mono text-3xs text-dim xl:inline">
        {now === null ? "DOY ---" : `DOY ${String(dayOfYearUtc(now)).padStart(3, "0")}`}
      </span>
    </div>
  );
}
