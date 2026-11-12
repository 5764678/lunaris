import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Titled block inside the mission panel. */
export function PanelSection({
  title,
  aside,
  children,
  className,
  id,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section aria-labelledby={headingId} className={cn("border-b border-hairline px-5 py-5", className)}>
      <header className="mb-3 flex min-h-6 items-center justify-between gap-2">
        <h2 id={headingId} className="text-sm font-semibold text-foreground">
          {title}
        </h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

/** Label/value row with a fixed label column and tabular numbers. */
export function DataRow({
  label,
  children,
  className,
  emphasis = false,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  /** A key number the visitor came for: set larger than the rows around it. */
  emphasis?: boolean;
}) {
  return (
    <div className={cn("grid grid-cols-[8.5rem_1fr] items-center gap-2 py-1", className)}>
      <dt className="text-2xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "numeric flex min-w-0 items-center justify-end gap-1.5 text-right font-mono text-foreground",
          emphasis ? "text-base" : "text-2xs",
        )}
      >
        {children}
      </dd>
    </div>
  );
}
