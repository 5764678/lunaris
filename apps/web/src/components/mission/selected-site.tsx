"use client";

import { Crosshair } from "lucide-react";

import { EvidenceBadge } from "@/components/evidence/evidence-badge";
import { useMemo, type ReactNode } from "react";

import { CellEvidence } from "@/components/evidence/cell-evidence";
import { describeError, type CompareCell, type CompareRow } from "@/lib/api/client";
import { useSiteComparison, useSiteEphemeris, useSiteTimeline, useSitesQuery } from "@/lib/api/queries";
import { calendarYearOf, formatPeriodUtc, metricCopy } from "@/lib/comparison/labels";
import { azElAt, toDirectionSeries } from "@/lib/terrain/sun";
import { formatLatitude, formatLongitude } from "@/lib/geo/selenographic";
import { formatUtc } from "@/lib/time/time";
import {
  LINE_OF_SIGHT_LABEL,
  formatFractionReadout,
  fractionAt,
  fractionSeriesFromTimeline,
} from "@/lib/timeline/fractions";
import { useMissionStore } from "@/store/mission-store";

import { DataRow, PanelSection } from "./panel-section";
import { SiteOriginBadge, TILE_CENTRE_NOTE } from "./site-origin";

/**
 * Selected-site cells filled from the T-17 comparison row for this site, in two groups: the
 * ground at the site (does not change with time) and the averages over the comparison dates.
 * Explanations come from `metricCopy`, so they match the comparison table.
 */
const GROUND_KEYS: (keyof CompareRow)[] = ["surface_height_m", "slope_at_site_deg", "roughness_rms_m"];
const AVERAGE_KEYS: { key: keyof CompareRow; name: string }[] = [
  { key: "sun_mean_visible_disk_fraction", name: "Sunlit" },
  { key: "earth_visible_fraction", name: "Earth visible" },
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
      </dl>
      <SiteGroup id="now" title="At the selected time" detail={<SelectedTime />}>
        <GeometryRows siteId={site.id} />
        <SelectedTimeFractions siteId={site.id} />
      </SiteGroup>
      <ComparisonGroups siteId={site.id} />
    </PanelSection>
  );
}

/**
 * A labelled block of rows. The panel mixes values that cover different stretches of time (the
 * selected moment, the whole comparison period, no time at all), so each block says which.
 */
function SiteGroup({
  id,
  title,
  detail,
  children,
}: {
  id: string;
  title: string;
  detail?: ReactNode;
  children: ReactNode;
}) {
  const headingId = `selected-site-${id}-heading`;
  return (
    <div
      role="group"
      aria-labelledby={headingId}
      data-testid={`selected-site-group-${id}`}
      className="mt-3 border-t border-hairline pt-2.5"
    >
      <h3 id={headingId} className="label-caps text-muted-foreground">
        {title}
      </h3>
      {detail && <p className="mt-0.5 mb-1 text-3xs text-dim">{detail}</p>}
      <dl>{children}</dl>
    </div>
  );
}

/** The timeline's selected moment, which the first group's values are computed for. */
function SelectedTime() {
  const epochMs = useMissionStore((s) => s.epochMs);
  return (
    <span data-testid="selected-site-time">
      {epochMs === null ? "Loading the timeline…" : `${formatUtc(epochMs)} UTC (set on the timeline)`}
    </span>
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
              ? "Loading Sun and Earth positions…"
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

/**
 * Sunlit share and Earth line of sight at the selected moment, from the same timeline analysis
 * the lanes plot (one shared query) and formatted by the same function, so this card and the
 * lanes always agree for the same moment. Not computed, with the reason, when unavailable.
 */
function SelectedTimeFractions({ siteId }: { siteId: string }) {
  const epochMs = useMissionStore((s) => s.epochMs);
  const startMs = useMissionStore((s) => s.windowStartMs);
  const endMs = useMissionStore((s) => s.windowEndMs);
  const query = useSiteTimeline(siteId, startMs, endMs);
  const series = useMemo(() => {
    if (!query.data) return null;
    try {
      return fractionSeriesFromTimeline(query.data);
    } catch {
      return null;
    }
  }, [query.data]);

  const sun = series && epochMs !== null ? fractionAt(series.illumination, epochMs) : null;
  const earth = series && epochMs !== null ? fractionAt(series.los, epochMs) : null;
  const reason = query.isError
    ? describeError(query.error)
    : query.isPending
      ? "Computing sunlight and Earth visibility…"
      : series
        ? "The selected time is outside the computed dates."
        : "The timeline analysis could not be read.";
  const notComputed = (
    <>
      <span className="text-dim">—</span>
      <EvidenceBadge kind="not_computed" label="N/C" detail={reason} />
    </>
  );
  const describe = (evidence: { statement?: string | null; method?: string | null }, extra: string) =>
    [evidence.statement, evidence.method, extra].filter(Boolean).join(" · ");

  return (
    <>
      <DataRow label="Sunlit">
        {series && sun ? (
          <>
            <EvidenceBadge
              kind={series.illumination.evidence.kind}
              detail={describe(
                series.illumination.evidence,
                'Share of the Sun\'s disk above the skyline at the selected time. The first number includes the terrain around the site (≤ means at most); "no hills" assumes a smooth Moon.',
              )}
            />
            <span className="numeric min-w-0" data-testid="selected-site-now-sunlit">
              {formatFractionReadout(series.illumination, sun)}
            </span>
          </>
        ) : (
          notComputed
        )}
      </DataRow>
      <DataRow label="Earth visible">
        {series && earth ? (
          <>
            <EvidenceBadge
              kind={series.los.evidence.kind}
              detail={describe(
                series.los.evidence,
                `Whether Earth is in view at the selected time, and the share of its disk above the skyline: ${formatFractionReadout(series.los, earth)}. Geometry only: it does not imply a working radio link.`,
              )}
            />
            <span className="numeric min-w-0" data-testid="selected-site-now-earth">
              {earth.state ? LINE_OF_SIGHT_LABEL[earth.state] : "—"}
              <span className="text-dim"> · geometric only</span>
            </span>
          </>
        ) : (
          notComputed
        )}
      </DataRow>
    </>
  );
}

/**
 * Height, slope, bumpiness and the sunlight and Earth-visibility averages from the site
 * comparison (T-17, default window). Each value opens its own evidence; while computing or on
 * error the rows say so (N/C with the reason), never 0. The averages sit in their own group with
 * the dates they cover, so they are never read as values for the selected moment.
 */
function ComparisonGroups({ siteId }: { siteId: string }) {
  const query = useSiteComparison([siteId]);
  const row = query.data?.rows.find((r) => r.site_id === siteId);
  const reason = query.isError
    ? describeError(query.error)
    : query.isPending
      ? "calculating site values…"
      : "site missing from the comparison";
  const year = query.data ? calendarYearOf(query.data.start_utc, query.data.end_utc) : null;

  const renderRow = (key: keyof CompareRow, label: string) => {
    const cell = row?.[key] as CompareCell | undefined;
    return (
      <DataRow key={key} label={label}>
        {cell ? (
          <CellEvidence
            cell={cell}
            label={`${label} (${siteLabel(row)})`}
            meaning={metricCopy(key, key).tip}
            align="end"
            testId={`selected-site-${key}`}
          />
        ) : (
          <>
            <span className="text-dim">—</span>
            <EvidenceBadge kind="not_computed" label="N/C" detail={reason} />
          </>
        )}
      </DataRow>
    );
  };

  return (
    <>
      <SiteGroup id="ground" title="Ground at the site" detail="Does not change with time.">
        {GROUND_KEYS.map((key) => renderRow(key, metricCopy(key, key).label))}
      </SiteGroup>
      <SiteGroup
        id="average"
        title={year ? `Over ${year}` : "Over the comparison dates"}
        detail={
          query.data ? (
            <span
              title={`Exact window: ${query.data.start_utc} → ${query.data.end_utc}`}
              data-testid="selected-site-period"
            >
              Average · {formatPeriodUtc(query.data.start_utc, query.data.end_utc)}
            </span>
          ) : (
            "Average · dates shown once calculated."
          )
        }
      >
        {AVERAGE_KEYS.map(({ key, name }) => renderRow(key, `${name}, ${year ? `${year} ` : ""}average`))}
      </SiteGroup>
    </>
  );
}

function siteLabel(row: CompareRow | undefined): string {
  return row?.name ?? "site";
}
