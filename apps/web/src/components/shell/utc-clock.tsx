"use client";

import { useEffect, useState } from "react";

import { formatLocalTime, formatUtcReadable, utcOffsetLabel } from "@/lib/time/time";

/**
 * Wall clock: UTC first (the standard for space work), then the visitor's own time. Renders a
 * placeholder until mounted (no prerendered timestamps), so the server never guesses a zone.
 * On a phone only the UTC time is shown, short enough to fit the bar.
 */
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
      <time
        className="numeric whitespace-nowrap font-mono text-2xs text-foreground"
        dateTime={now === null ? undefined : new Date(now).toISOString()}
        suppressHydrationWarning
        title="Coordinated Universal Time, the standard clock for space work"
      >
        {now === null ? (
          "-- --- ---- --:--:--"
        ) : (
          <>
            <span className="max-md:hidden">{formatUtcReadable(now, true)}</span>
            <span className="md:hidden">{formatUtcReadable(now).slice(-5)}</span>
          </>
        )}{" "}
        <span className="text-dim">UTC</span>
      </time>
      {now !== null && (
        <span
          className="numeric hidden font-mono text-2xs text-muted-foreground 2xl:inline"
          suppressHydrationWarning
        >
          {formatLocalTime(now, true)} <span className="font-sans text-dim">your time ({utcOffsetLabel(now)})</span>
        </span>
      )}
    </div>
  );
}
