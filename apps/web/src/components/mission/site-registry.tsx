"use client";

import type { CandidateSite } from "@lunaris/shared-types";
import { MapPin, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { describeError } from "@/lib/api/client";
import { useConnection, useDeleteSite, useSitesQuery } from "@/lib/api/queries";
import { formatLatitude, formatLongitude } from "@/lib/geo/selenographic";
import { cn } from "@/lib/utils";
import { useMissionStore } from "@/store/mission-store";

import { PanelSection } from "./panel-section";
import { CatalogDemoTrio } from "./catalog-demo-trio";
import { SiteForm } from "./site-form";
import { SiteOriginBadge } from "./site-origin";

export function SiteRegistry() {
  const sites = useSitesQuery();
  const connection = useConnection();
  const unreachable = connection.kind === "offline" || connection.kind === "waking";

  return (
    <PanelSection
      id="sites"
      title="Candidate sites"
      aside={
        sites.data && (
          <span className="numeric font-mono text-3xs text-dim">
            {sites.data.count}/{sites.data.limit}
          </span>
        )
      }
    >
      <CatalogDemoTrio />
      <div className="mb-3">
        {sites.isPending ? (
          <div className="space-y-1.5" aria-label="Loading sites">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        ) : sites.isError ? (
          <div
            role="alert"
            className="flex items-start justify-between gap-2 rounded-md border border-critical/25 bg-critical/5 p-2.5"
          >
            <p className="text-2xs text-critical/90">{describeError(sites.error)}</p>
            <Button size="xs" variant="outline" onClick={() => void sites.refetch()}>
              <RotateCcw /> Retry
            </Button>
          </div>
        ) : sites.data.sites.length === 0 ? (
          <div
            data-testid="sites-empty"
            className="hatch rounded-md border border-dashed border-border px-3 py-4 text-center"
          >
            <p className="text-2xs text-muted-foreground">No candidate sites registered.</p>
            <p className="mt-0.5 text-3xs text-dim">
              Add the cited demo sites above, or a site by coordinates below.
            </p>
          </div>
        ) : (
          <ul className="space-y-1" data-testid="site-list">
            {sites.data.sites.map((site) => (
              <SiteRow key={site.id} site={site} />
            ))}
          </ul>
        )}
      </div>
      <SiteForm disabled={unreachable} />
    </PanelSection>
  );
}

function SiteRow({ site }: { site: CandidateSite }) {
  const selectedSiteId = useMissionStore((s) => s.selectedSiteId);
  const selectSite = useMissionStore((s) => s.selectSite);
  const deleteSite = useDeleteSite();
  const [confirming, setConfirming] = useState(false);
  const selected = selectedSiteId === site.id;

  useEffect(() => {
    if (!confirming) return;
    const id = window.setTimeout(() => setConfirming(false), 3_000);
    return () => window.clearTimeout(id);
  }, [confirming]);

  return (
    <li
      className={cn(
        "group flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors",
        selected
          ? "border-primary-strong/50 bg-accent/70"
          : "border-transparent hover:border-border hover:bg-panel-raised",
      )}
    >
      <button
        type="button"
        onClick={() => selectSite(selected ? null : site.id)}
        aria-pressed={selected}
        className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <MapPin className={cn("size-3.5 shrink-0", selected ? "text-primary" : "text-dim")} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs text-foreground">{site.name}</span>
          <span className="numeric block font-mono text-3xs text-muted-foreground">
            {formatLatitude(site.coordinate.latitude_deg)} {formatLongitude(site.coordinate.longitude_deg)}
          </span>
        </span>
      </button>
      <SiteOriginBadge site={site} />
      <Button
        size="icon-xs"
        variant={confirming ? "destructive" : "ghost"}
        aria-label={confirming ? `Confirm deletion of ${site.name}` : `Delete ${site.name}`}
        disabled={deleteSite.isPending}
        onClick={() => {
          if (!confirming) {
            setConfirming(true);
            return;
          }
          deleteSite.mutate(site.id, {
            onSuccess: () => {
              if (selected) selectSite(null);
            },
          });
        }}
        className={cn(!confirming && "opacity-60 group-hover:opacity-100")}
      >
        <Trash2 />
      </Button>
    </li>
  );
}
