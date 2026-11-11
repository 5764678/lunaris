"use client";

import { useEffect, useState } from "react";

import { useHydrated } from "@/lib/use-hydrated";
import { formatLocalReadable, formatLocalTime, formatUtcReadable, utcOffsetLabel } from "@/lib/time/time";
import { restoreZoneMode, useZoneStore } from "@/lib/time/zone-store";
import { cn } from "@/lib/utils";

/**
 * A moment as UTC first, then the visitor's own time: `10 Nov 2026 15:09 UTC · 22:09 your time
 * (UTC+7)`. The local part appears only after the page has loaded in the browser, because the
 * server does not know the visitor's zone.
 */
export function Timestamp({
  ms,
  seconds = false,
  className,
  testId,
}: {
  ms: number;
  seconds?: boolean;
  className?: string;
  testId?: string;
}) {
  const hydrated = useHydrated();
  return (
    <span className={className} data-testid={testId}>
      {formatUtcReadable(ms, seconds)} UTC
      {hydrated && (
        <span className="text-dim">
          {" "}
          · {formatLocalTime(ms, seconds)} your time ({utcOffsetLabel(ms)})
        </span>
      )}
    </span>
  );
}

/** One moment in the zone the visitor picked with the UTC / Local switch, for table cells. */
export function TableTime({ ms, seconds = false }: { ms: number; seconds?: boolean }) {
  const hydrated = useHydrated();
  const mode = useZoneStore((s) => s.mode);
  if (hydrated && mode === "local") {
    return (
      <time dateTime={new Date(ms).toISOString()}>
        {formatLocalReadable(ms, seconds)} <span className="text-dim">{utcOffsetLabel(ms)}</span>
      </time>
    );
  }
  return (
    <time dateTime={new Date(ms).toISOString()}>
      {formatUtcReadable(ms, seconds)} <span className="text-dim">UTC</span>
    </time>
  );
}

/** Switch for the time tables: UTC (default) or the visitor's local time. Remembered. */
export function ZoneToggle({ className }: { className?: string }) {
  const mode = useZoneStore((s) => s.mode);
  const setMode = useZoneStore((s) => s.setMode);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    restoreZoneMode();
    const read = () => setNow(Date.now());
    read();
  }, []);
  const item = (value: "utc" | "local", text: string) => (
    <button
      type="button"
      aria-pressed={mode === value}
      onClick={() => setMode(value)}
      className={cn(
        "rounded px-2 py-0.5 text-3xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        mode === value ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {text}
    </button>
  );
  return (
    <div
      role="group"
      aria-label="Time zone for the tables"
      className={cn("inline-flex items-center gap-0.5 rounded-md border border-border p-0.5", className)}
    >
      {item("utc", "UTC")}
      {item("local", now === null ? "Your time" : `Your time (${utcOffsetLabel(now)})`)}
    </div>
  );
}
