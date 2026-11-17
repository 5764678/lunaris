"use client";

import { useMemo } from "react";

import { CellEvidence } from "@/components/evidence/cell-evidence";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";
import { describeError, type TimelineAnalysis } from "@/lib/api/client";
import { TableTime, Timestamp, ZoneToggle } from "@/components/time/timestamp";
import { formatUtcReadable } from "@/lib/time/time";

import {
  bodyTracks,
  earthRows,
  earthWindows,
  horizonMaxCell,
  horizonProfile,
  horizonTruncatedCell,
  radioLinkDisclaimer,
  sunRows,
  sunlitWindows,
  trackMaxCell,
  windowDurationCell,
  type Cell,
  type HorizonMask,
  type SummaryRow,
  type WindowList,
} from "../_lib/model";
import { useIlluminationTimeline, useSiteHorizon } from "../_lib/queries";

import { SKY_COLORS, SkyChart } from "./sky-chart";

const MAX_WINDOWS_SHOWN = 40;

function Value({ c, label, testId, meaning }: { c: Cell; label: string; testId: string; meaning?: string }) {
  return (
    <span className="inline-flex items-baseline gap-0.5" data-lower-bound={c.lowerBound ? "true" : "false"}>
      {c.lowerBound && c.cell.value !== null && (
        <span className="font-mono text-2xs text-warn" aria-label="at least">
          ≥
        </span>
      )}
      <CellEvidence cell={c.cell} label={label} testId={testId} meaning={meaning} />
    </span>
  );
}

function NotComputed({ what, error, testId }: { what: string; error: unknown; testId: string }) {
  return (
    <p className="font-mono text-3xs text-dim italic" data-testid={testId} role="status">
      N/C · {what} not computed: <span className="not-italic">{describeError(error)}</span>
    </p>
  );
}

function Legend({ hasLowerBounds }: { hasLowerBounds: boolean }) {
  const item = (color: string, text: string, shape: "dot" | "bar" | "tri" | "dash") => (
    <li className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="inline-block"
        style={
          shape === "dot"
            ? { width: 7, height: 7, borderRadius: 9999, background: color }
            : shape === "bar"
              ? { width: 12, height: 7, background: color, opacity: 0.45 }
              : shape === "tri"
                ? {
                    width: 0,
                    height: 0,
                    borderLeft: "4px solid transparent",
                    borderRight: "4px solid transparent",
                    borderBottom: `7px solid ${color}`,
                  }
                : { width: 12, borderTop: `1px dashed ${color}` }
        }
      />
      {text}
    </li>
  );
  return (
    <ul
      className="space flex flex-wrap gap-x-4 gap-y-1 rounded-md bg-panel-sunken px-3 py-2 text-3xs text-muted-foreground"
      data-testid="sky-legend"
    >
      {item(SKY_COLORS.terrain, "Terrain skyline (LOLA 240 m)", "bar")}
      {hasLowerBounds &&
        item(SKY_COLORS.lowerBound, "Ray left DEM coverage: skyline is a lower bound", "tri")}
      {item(SKY_COLORS.terrain, "No hills: level horizon (0°)", "dash")}
      {item(SKY_COLORS.sun, "Sun centre, bar = ± disk radius", "dot")}
      {item(SKY_COLORS.earth, "Earth centre, bar = ± disk radius", "dot")}
    </ul>
  );
}

function SummaryTable({ title, rows, testId }: { title: string; rows: SummaryRow[]; testId: string }) {
  return (
    <HorizontalScroll label={`${title} (scrolls sideways)`}>
      <table className="w-full min-w-[16rem] text-2xs" data-testid={testId}>
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr className="text-left">
            <th scope="col" className="label-caps py-1 pr-2 font-normal">
              Measure
            </th>
            <th scope="col" className="label-caps py-1 pr-2 font-normal">
              Terrain horizon
            </th>
            <th scope="col" className="label-caps py-1 font-normal">
              No hills
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-hairline align-top">
              <th scope="row" className="py-1 pr-2 text-left font-normal text-muted-foreground">
                {r.label}
              </th>
              <td className="py-1 pr-2">
                <Value
                  c={r.terrain}
                  label={`${r.label} · terrain horizon`}
                  testId={`${testId}-${r.key}-terrain`}
                  meaning={r.meaning}
                />
              </td>
              <td className="py-1">
                <Value
                  c={r.astronomical}
                  label={`${r.label} · no hills`}
                  testId={`${testId}-${r.key}-astronomical`}
                  meaning={r.meaning}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </HorizontalScroll>
  );
}

function WindowTable({
  title,
  list,
  testId,
  wholePeriodText,
}: {
  title: string;
  list: WindowList;
  testId: string;
  /** What a run that fills the whole period reads as, e.g. "Sunlit for the whole period". */
  wholePeriodText: string;
}) {
  const shown = list.windows.slice(0, MAX_WINDOWS_SHOWN);
  return (
    <div className="space-y-1">
      <p className="label-caps">
        {title} · {list.windows.length} · {list.horizon === "terrain" ? "terrain horizon" : "no hills"}
      </p>
      {list.windows.length === 0 ? (
        <p className="text-3xs text-dim" data-testid={`${testId}-empty`}>
          No window in the analysis period.
        </p>
      ) : (
        <HorizontalScroll label={`${title} (scrolls sideways)`}>
          <table className="w-full min-w-[16rem] text-2xs" data-testid={testId}>
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="text-left">
                <th scope="col" className="label-caps py-1 pr-2 font-normal">
                  Start
                </th>
                <th scope="col" className="label-caps py-1 pr-2 font-normal">
                  End
                </th>
                <th scope="col" className="label-caps py-1 font-normal">
                  Duration
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((w, i) => {
                const c = windowDurationCell(list, w);
                return (
                  <tr
                    key={w.start_utc}
                    className="border-t border-hairline align-top"
                    data-testid={`${testId}-row`}
                    data-censored={c.lowerBound ? "true" : "false"}
                  >
                    {w.censored_start && w.censored_end ? (
                      <td colSpan={2} className="py-1 pr-2 text-2xs text-muted-foreground">
                        {wholePeriodText}
                      </td>
                    ) : (
                      <>
                        <td className="numeric py-1 pr-2 font-mono text-3xs text-muted-foreground">
                          <TableTime ms={Date.parse(w.start_utc)} />
                          {w.censored_start && (
                            <span className="block text-warn">began before this period</span>
                          )}
                        </td>
                        <td className="numeric py-1 pr-2 font-mono text-3xs text-muted-foreground">
                          <TableTime ms={Date.parse(w.end_utc)} />
                          {w.censored_end && (
                            <span className="block text-warn">continues after this period</span>
                          )}
                        </td>
                      </>
                    )}
                    <td className="py-1">
                      <Value
                        c={c}
                        label={`${title} ${i + 1} · duration`}
                        testId={`${testId}-duration-${i}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </HorizontalScroll>
      )}
      {list.windows.length > shown.length && (
        <p className="text-3xs text-dim">
          First {shown.length} of {list.windows.length} shown.
        </p>
      )}
    </div>
  );
}

function SkySection({
  horizon,
  timeline,
}: {
  horizon: { data?: HorizonMask; error: unknown; isError: boolean };
  timeline: { data?: TimelineAnalysis; error: unknown; isError: boolean };
}) {
  const profile = useMemo(() => (horizon.data ? horizonProfile(horizon.data) : null), [horizon.data]);
  const tracks = useMemo(() => (timeline.data ? bodyTracks(timeline.data) : null), [timeline.data]);
  const trackList = useMemo(() => (tracks ? [tracks.sun, tracks.earth] : []), [tracks]);
  const loading = (!horizon.data && !horizon.isError) || (!timeline.data && !timeline.isError);

  return (
    <section aria-label="Sky chart" className="space-y-2 rounded-md border border-border bg-panel p-3">
      <h2 className="text-sm font-medium text-foreground">Skyline, Sun and Earth</h2>
      {loading ? (
        <p className="text-3xs text-dim" role="status" data-testid="sky-loading">
          Loading the horizon mask and the Sun and Earth positions… The first request for a site computes its
          horizon and can take a few seconds.
        </p>
      ) : profile || trackList.length > 0 ? (
        <SkyChart profile={profile} tracks={trackList} />
      ) : null}
      {horizon.isError && (
        <NotComputed what="Terrain horizon" error={horizon.error} testId="horizon-unavailable" />
      )}
      {timeline.isError && (
        <NotComputed what="Sun and Earth tracks" error={timeline.error} testId="tracks-unavailable" />
      )}
      {!loading && <Legend hasLowerBounds={(profile?.truncatedCount ?? 0) > 0} />}
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-2xs sm:grid-cols-2">
        {horizon.data && (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">Highest skyline</dt>
              <dd>
                <Value
                  c={horizonMaxCell(horizon.data)}
                  label="Highest terrain skyline"
                  testId="horizon-max"
                  meaning={`Maximum of the ${horizon.data.azimuth_deg.length} served azimuths (every ${horizon.data.azimuth_step_deg}°), above the local horizontal plane.`}
                />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">Directions where the map ran out</dt>
              <dd>
                <Value
                  c={horizonTruncatedCell(horizon.data)}
                  label="Truncated horizon azimuths"
                  testId="horizon-truncated"
                  meaning={`Azimuths whose ray left DEM coverage before ${horizon.data.max_range_m / 1000} km: the real skyline there is at least as high as drawn.`}
                />
              </dd>
            </div>
          </>
        )}
        {timeline.data && tracks && (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">Sun highest in window</dt>
              <dd>
                <Value
                  c={trackMaxCell(
                    tracks.sun,
                    timeline.data.illumination.evidence,
                    timeline.data.illumination.limitations,
                  )}
                  label="Highest Sun centre elevation"
                  testId="sun-max"
                  meaning="Highest elevation of the Sun's centre among the samples of this window, above the local horizontal plane."
                />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">Earth highest in window</dt>
              <dd>
                <Value
                  c={trackMaxCell(
                    tracks.earth,
                    timeline.data.earth_visibility.evidence,
                    timeline.data.earth_visibility.limitations,
                  )}
                  label="Highest Earth centre elevation"
                  testId="earth-max"
                  meaning="Highest elevation of the Earth's centre among the samples of this window, above the local horizontal plane."
                />
              </dd>
            </div>
          </>
        )}
      </dl>
    </section>
  );
}

export function SiteIllumination({
  siteId,
  window,
}: {
  siteId: string;
  window: { startMs: number; endMs: number; stepS: number };
}) {
  const horizon = useSiteHorizon(siteId);
  const timeline = useIlluminationTimeline(siteId, window);
  const data = timeline.data;

  return (
    <div className="space-y-4" data-testid="site-illumination" data-site-id={siteId}>
      <SkySection horizon={horizon} timeline={timeline} />

      {data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-2xs text-muted-foreground">Times in the tables below are shown in:</p>
            <ZoneToggle />
          </div>
          <section aria-label="Sunlight" className="space-y-3 rounded-md border border-border bg-panel p-3">
            <h2 className="text-sm font-medium text-foreground">Sunlight</h2>
            <SummaryTable title="Sunlight summary" rows={sunRows(data)} testId="sun-summary" />
            <WindowTable
              title="Sunlit windows"
              list={sunlitWindows(data)}
              testId="sun-windows"
              wholePeriodText="Sunlit for the whole period"
            />
          </section>

          <section
            aria-label="Earth visibility"
            className="space-y-3 rounded-md border border-border bg-panel p-3"
          >
            <h2 className="text-sm font-medium text-foreground">Earth line of sight</h2>
            <p
              className="rounded-sm border border-warn/40 bg-warn/10 px-2 py-1 text-2xs text-foreground"
              data-testid="radio-link-disclaimer"
            >
              {radioLinkDisclaimer(data)}
            </p>
            <SummaryTable title="Earth visibility summary" rows={earthRows(data)} testId="earth-summary" />
            <WindowTable
              title="Earth visibility windows"
              list={earthWindows(data)}
              testId="earth-windows"
              wholePeriodText="Earth in view for the whole period"
            />
          </section>

          <p className="text-3xs text-dim" data-testid="illumination-period">
            {data.site_name} · {formatUtcReadable(Date.parse(data.start_utc))} to{" "}
            {formatUtcReadable(Date.parse(data.end_utc))} UTC · {data.sample_count} samples every{" "}
            {data.step_s / 3600} h · computed <Timestamp ms={Date.parse(data.computed_at_utc)} />
          </p>
        </>
      )}
    </div>
  );
}
