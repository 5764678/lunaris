"use client";

import { Crosshair } from "lucide-react";

import { EvidenceBadge } from "@/components/evidence/evidence-badge";
import { useMemo } from "react";

import { describeError } from "@/lib/api/client";
import { useSiteEphemeris, useSitesQuery } from "@/lib/api/queries";
import { azElAt, toDirectionSeries } from "@/lib/terrain/sun";
import { formatLatitude, formatLongitude } from "@/lib/geo/selenographic";
import { useMissionStore } from "@/store/mission-store";

import { DataRow, PanelSection } from "./panel-section";
import { SiteOriginBadge, TILE_CENTRE_NOTE } from "./site-origin";

const NOT_COMPUTED_ROWS: { label: string; milestone: string; detail: string }[] = [
  { label: "Height", milestone: "M02", detail: "Sampled from a LOLA DEM in Milestone 02." },
  { label: "Slope", milestone: "M02", detail: "Horn (1981) slope on the polar grid — Milestone 02." },
  { label: "Roughness", milestone: "M02", detail: "Defined roughness statistic — Milestone 02." },
  { label: "Illumination", milestone: "M04", detail: "Terrain-aware illumination — Milestone 04." },
  { label: "Earth LOS", milestone: "M04", detail: "Terrain-obstructed line of sight — Milestone 04." },
];

export function SelectedSite() {
  const selectedSiteId = useMissionStore((s) => s.selectedSiteId);
  const sites = useSitesQuery();
  const site = sites.data?.sites.find((s) => s.id === selectedSiteId);

  if (!site) {
    return (
      <PanelSection id="selected-site" title="Selected site">
        <div className="flex items-center gap-2.5 py-1 text-2xs text-dim">
          <Crosshair className="size-4" aria-hidden="true" />
          Select a candidate site from the list or on the globe.
        </div>
      </PanelSection>
    );
  }

  const position = site.body_fixed_position;
  const km = (m: number) => (m / 1000).toFixed(3);

  return (
    <PanelSection id="selected-site" title="Selected site" aside={<SiteOriginBadge site={site} />}>
      <p className="mb-2 truncate text-sm text-foreground" data-testid="selected-site-name">
        {site.name}
      </p>
      <dl>
        <DataRow label="Latitude">{formatLatitude(site.coordinate.latitude_deg, 4)}</DataRow>
        <DataRow label="Longitude">{formatLongitude(site.coordinate.longitude_deg, 4)}</DataRow>
        <DataRow label="Frame">{site.coordinate.frame}</DataRow>
        {site.origin === "published" && (
          <DataRow label="Source">
            <span
              className="min-w-0 text-2xs whitespace-normal text-muted-foreground"
              data-testid="selected-site-source"
            >
              {site.reference ?? "Published catalogue"} · {TILE_CENTRE_NOTE}
            </span>
          </DataRow>
        )}
        <DataRow label="Body-fixed (km)">
          <EvidenceBadge
            kind="calculation"
            detail={`${position.evidence.method ?? ""} ${position.evidence.assumptions.join(" ")}`.trim()}
          />
          <span className="truncate">
            {km(position.x_m)}, {km(position.y_m)}, {km(position.z_m)}
          </span>
        </DataRow>
        <GeometryRows siteId={site.id} />
        {NOT_COMPUTED_ROWS.map((row) => (
          <DataRow key={row.label} label={row.label}>
            <span className="text-dim">—</span>
            <EvidenceBadge kind="not_computed" label={`N/C · ${row.milestone}`} detail={row.detail} />
          </DataRow>
        ))}
      </dl>
    </PanelSection>
  );
}

const fmtSigned = (deg: number) => `${deg >= 0 ? "+" : "−"}${Math.abs(deg).toFixed(2)}°`;

/**
 * Sun and Earth azimuth/elevation at the epoch (C2, SPICE via the API), shared with the
 * timeline lanes' query. Shown as not computed, with the reason, when unavailable.
 */
function GeometryRows({ siteId }: { siteId: string }) {
  const epochMs = useMissionStore((s) => s.epochMs);
  const startMs = useMissionStore((s) => s.windowStartMs);
  const endMs = useMissionStore((s) => s.windowEndMs);
  const query = useSiteEphemeris(siteId, startMs, endMs);
  const bodies = useMemo(
    () =>
      (query.data?.bodies ?? []).map((b) => ({
        body: b.body,
        evidence: b.evidence,
        series: toDirectionSeries(b.samples),
      })),
    [query.data],
  );
  return (
    <>
      {(["sun", "earth"] as const).map((id) => {
        const label = id === "sun" ? "Sun az / el" : "Earth az / el";
        const body = bodies.find((b) => b.body === id);
        const value = body && epochMs !== null ? azElAt(body.series, epochMs) : null;
        if (!body || !value) {
          const reason = query.isError
            ? describeError(query.error)
            : query.isPending
              ? "Computing SPICE geometry…"
              : "Epoch outside the computed window.";
          return (
            <DataRow key={id} label={label}>
              <span className="text-dim">—</span>
              <EvidenceBadge kind="not_computed" label="N/C" detail={reason} />
            </DataRow>
          );
        }
        return (
          <DataRow key={id} label={label}>
            <EvidenceBadge
              kind={body.evidence.kind}
              detail={`${body.evidence.statement} Interpolated between hourly samples for display; elevation is above the astronomical horizon (C0 plane), not the terrain horizon.`}
            />
            <span className="numeric" data-testid={`selected-site-${id}-azel`}>
              {value.azimuthDeg.toFixed(1)}° / {fmtSigned(value.elevationDeg)}
            </span>
          </DataRow>
        );
      })}
    </>
  );
}
