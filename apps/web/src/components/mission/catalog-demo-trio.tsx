"use client";

import { ExternalLink, Plus } from "lucide-react";

import { EvidenceBadge } from "@/components/evidence/evidence-badge";
import { Button } from "@/components/ui/button";
import { describeError } from "@/lib/api/client";
import { useRegisterDemoTrio, useSiteCatalog, useSitesQuery } from "@/lib/api/queries";
import { formatLatitude, formatLongitude } from "@/lib/geo/selenographic";

import { isHttpsUrl } from "../viewport/surface-source";
import { TILE_CENTRE_NOTE } from "./site-origin";

/**
 * The three cited demo sites from the catalogue (`demo_trio`), added in one action.
 * Each shows its source; coordinates are DEM tile centres, never landing points.
 */
export function CatalogDemoTrio() {
  const catalog = useSiteCatalog();
  const sites = useSitesQuery().data?.sites;
  const register = useRegisterDemoTrio();

  if (!catalog.data) {
    if (catalog.isError) {
      return (
        <p className="mb-3 text-3xs text-critical/90" role="alert">
          Site catalogue unavailable: {describeError(catalog.error)}
        </p>
      );
    }
    return null;
  }

  const trio = catalog.data.sites.filter((s) => s.demo_trio);
  if (trio.length === 0) return null;
  const registered = new Set((sites ?? []).map((s) => s.name.toLowerCase()));
  const missing = trio.filter((s) => !registered.has(s.name.toLowerCase())).length;
  const source = catalog.data.sources[0];

  return (
    <div
      className="mb-3 rounded-md border border-hairline bg-panel-sunken/50 p-2.5"
      data-testid="catalog-trio"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-2xs text-foreground">
          <EvidenceBadge kind="derived_product" label="CITED" detail={catalog.data.citation} />
          Cited demo sites
        </p>
        <Button
          size="xs"
          variant="outline"
          disabled={missing === 0 || register.isPending}
          onClick={() => register.mutate()}
        >
          <Plus /> {missing === 0 ? "All added" : `Add ${missing} cited site${missing === 1 ? "" : "s"}`}
        </Button>
      </div>
      <p className="mb-1.5 text-3xs leading-relaxed text-dim">
        Three of the candidate landing regions NASA named for Artemis III in 2022, near the Moon&apos;s south
        pole, with published 5 m elevation maps.
      </p>
      <ul className="space-y-1">
        {trio.map((s) => (
          <li key={s.id} className="flex items-baseline justify-between gap-2 text-3xs">
            <span className="min-w-0 text-muted-foreground">
              {s.name}
              <span className="text-dim"> · {s.pgda_site_id}</span>
              {s.artemis_iii_2022_region && <span className="text-dim"> · Artemis III region (2022)</span>}
            </span>
            <span className="numeric shrink-0 font-mono text-dim">
              {formatLatitude(s.reference_point.latitude_deg)}{" "}
              {formatLongitude(s.reference_point.longitude_deg)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-3xs leading-relaxed text-dim">
        {TILE_CENTRE_NOTE} Source:{" "}
        {source && isHttpsUrl(source.url) ? (
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-0.5 underline decoration-dotted underline-offset-2 hover:text-foreground"
          >
            {source.title}
            <ExternalLink className="size-2.5" aria-hidden="true" />
          </a>
        ) : (
          catalog.data.citation
        )}
      </p>
      {register.isError && (
        <p role="alert" className="mt-1 text-3xs text-critical">
          {describeError(register.error)}
        </p>
      )}
    </div>
  );
}
