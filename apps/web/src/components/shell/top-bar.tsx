import Link from "next/link";

import { Badge } from "@/components/ui/badge";

import { BrandMark } from "./brand-mark";
import { ConnectionStatus } from "./connection-status";
import { DataStatusIndicator } from "./data-status";
import { UtcClock } from "./utc-clock";

export function TopBar() {
  return (
    <header className="col-span-2 flex h-11 items-center gap-3 border-b border-border bg-surface px-3">
      <Link
        href="/"
        className="flex items-center gap-2.5 rounded-md pr-1 text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label="LUNARIS home"
      >
        <BrandMark />
        <span className="font-mono text-[13px] font-semibold tracking-[0.32em] text-foreground">LUNARIS</span>
      </Link>
      <span className="hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
      <div className="hidden min-w-0 items-center gap-2 sm:flex">
        <Badge variant="info">Mission</Badge>
        <span className="truncate text-2xs text-muted-foreground max-xl:hidden">
          Lunar Mission Intelligence &amp; Surface Operations Platform
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <DataStatusIndicator />
        <ConnectionStatus />
        <Badge variant="muted" className="hidden lg:inline-flex" title="Milestone 01 foundation build">
          M01
        </Badge>
        <span className="hidden h-4 w-px bg-border md:block" aria-hidden="true" />
        <div className="hidden md:block">
          <UtcClock />
        </div>
      </div>
    </header>
  );
}
