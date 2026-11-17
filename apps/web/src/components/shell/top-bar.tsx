"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useT } from "@/lib/i18n";
import { isLessonRoute } from "@/lib/lesson/route";

import { BrandMark } from "./brand-mark";
import { ConnectionStatus } from "./connection-status";
import { DataStatusIndicator } from "./data-status";
import { LanguageSwitch } from "./language-switch";
import { UtcClock } from "./utc-clock";

export function TopBar() {
  const t = useT();
  // The lesson route reads static data only (decision D10): no API status polling there.
  const lesson = isLessonRoute(usePathname());
  return (
    <header className="col-span-2 flex h-11 items-center gap-3 border-b border-border bg-surface px-3">
      <Link
        href="/"
        className="flex items-center gap-2.5 rounded-md pr-1 text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label={t.shell.homeLabel}
      >
        <BrandMark />
        <span className="font-mono text-[13px] font-semibold tracking-[0.32em] text-foreground">LUNARIS</span>
      </Link>
      <span className="hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
      <div className="hidden min-w-0 items-center gap-2 sm:flex">
        <span className="truncate text-2xs text-muted-foreground max-xl:hidden">{t.shell.tagline}</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <LanguageSwitch />
        {!lesson && (
          <>
            <DataStatusIndicator />
            <ConnectionStatus />
          </>
        )}
        <span className="hidden h-4 w-px bg-border md:block" aria-hidden="true" />
        <UtcClock />
      </div>
    </header>
  );
}
