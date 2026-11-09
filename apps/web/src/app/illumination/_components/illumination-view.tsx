"use client";

import { useMemo, useState, useSyncExternalStore, type KeyboardEvent } from "react";

import { CatalogDemoTrio } from "@/components/mission/catalog-demo-trio";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { describeError } from "@/lib/api/client";
import { useSiteCatalog, useSitesQuery } from "@/lib/api/queries";
import { DEFAULT_SITE_NAME } from "@/lib/sites/default-site";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";

import { WINDOWS, siteTabs, windowBounds, type AnalysisWindow } from "../_lib/model";

import { SiteIllumination } from "./site-illumination";

const subscribe = () => () => {};
let visitMs: number | null = null;

/**
 * The clock, read once on the client (never during prerender: the server snapshot is null)
 * and fixed for the visit, so requests and their cache entries do not move with the clock.
 */
function visitStartMs(): number {
  visitMs ??= Date.now();
  return visitMs;
}

export function IlluminationView() {
  const hydrated = useHydrated();
  const sites = useSitesQuery();
  const catalog = useSiteCatalog();
  const [chosen, setChosen] = useState<string | null>(null);
  const [windowKey, setWindowKey] = useState<AnalysisWindow["key"]>("30d");
  const nowMs = useSyncExternalStore(subscribe, visitStartMs, () => null);

  const demoNames = useMemo(
    () => (catalog.data?.sites ?? []).filter((s) => s.demo_trio).map((s) => s.name),
    [catalog.data],
  );
  const tabs = useMemo(() => siteTabs(sites.data?.sites ?? [], demoNames), [sites.data, demoNames]);
  // Default: the same cited site the dashboard opens on, else the first demo (or registered) site.
  const fallback =
    tabs.find((t) => t.demo && t.name.toLowerCase() === DEFAULT_SITE_NAME.toLowerCase()) ?? tabs[0] ?? null;
  const selected = tabs.find((t) => t.id === chosen) ?? fallback;
  const spec = WINDOWS.find((w) => w.key === windowKey) ?? WINDOWS[0]!;
  const window = useMemo(
    () => (nowMs === null ? null : { ...windowBounds(nowMs, spec), stepS: spec.stepS }),
    [nowMs, spec],
  );
  const demoCount = tabs.filter((t) => t.demo).length;

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta || tabs.length === 0) return;
    event.preventDefault();
    const next = tabs[(index + delta + tabs.length) % tabs.length]!;
    setChosen(next.id);
    document.getElementById(`illumination-tab-${next.id}`)?.focus();
  }

  return (
    <div className="space-y-4">
      {hydrated && catalog.data && demoCount < 3 && <CatalogDemoTrio />}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 max-w-full space-y-1.5">
          <p className="label-caps">Site</p>
          {sites.isError ? (
            <p className="text-3xs text-critical/90" role="alert">
              Sites unavailable: {describeError(sites.error)}
            </p>
          ) : tabs.length === 0 ? (
            <p className="text-2xs text-dim" data-testid="illumination-no-sites">
              {sites.data ? "No registered sites. Add the cited demo sites above." : "Loading sites…"}
            </p>
          ) : (
            <div
              role="tablist"
              aria-label="Site"
              className="flex max-w-full gap-1 overflow-x-auto scrollbar-thin pb-1"
              data-testid="illumination-site-tabs"
            >
              {tabs.map((t, i) => {
                const on = t.id === selected?.id;
                return (
                  <button
                    key={t.id}
                    id={`illumination-tab-${t.id}`}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    aria-controls="illumination-panel"
                    tabIndex={on ? 0 : -1}
                    onClick={() => setChosen(t.id)}
                    onKeyDown={(e) => onTabKey(e, i)}
                    data-demo={t.demo ? "true" : "false"}
                    className={cn(
                      "shrink-0 rounded-md border px-2 py-1 text-2xs whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      on
                        ? "border-primary-strong/50 bg-accent/70 text-foreground"
                        : "border-border text-muted-foreground hover:bg-panel-raised",
                    )}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <p className="label-caps">Window from 00:00 UTC today</p>
          <ToggleGroup
            type="single"
            value={windowKey}
            onValueChange={(v) => v && setWindowKey(v as AnalysisWindow["key"])}
            aria-label="Analysis window"
            data-testid="illumination-window"
          >
            {WINDOWS.map((w) => (
              <ToggleGroupItem key={w.key} value={w.key}>
                {w.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      {selected && window && (
        <div
          id="illumination-panel"
          role="tabpanel"
          aria-labelledby={`illumination-tab-${selected.id}`}
          data-testid="illumination-panel"
        >
          <SiteIllumination key={`${selected.id}-${spec.key}`} siteId={selected.id} window={window} />
        </div>
      )}
    </div>
  );
}
