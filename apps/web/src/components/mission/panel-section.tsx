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
    <section aria-labelledby={headingId} className={cn("border-b border-hairline px-4 py-3.5", className)}>
      <header className="mb-2.5 flex min-h-5 items-center justify-between gap-2">
        <h2 id={headingId} className="label-caps text-muted-foreground">
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
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-[7.5rem_1fr] items-center gap-2 py-[3px]", className)}>
      <dt className="text-2xs text-dim">{label}</dt>
      <dd className="numeric flex min-w-0 items-center justify-end gap-1.5 text-right font-mono text-2xs text-foreground">
        {children}
      </dd>
    </div>
  );
}
