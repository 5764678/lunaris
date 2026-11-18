"use client";

import { useCallback, useMemo } from "react";

import { bodyTracks, horizonProfile } from "@/app/illumination/_lib/model";
import { useLanguage } from "@/lib/i18n";
import { formatUtcDate } from "@/lib/lesson/format";
import { loadPackIndex, loadSiteBundle, loadSiteTimeline } from "@/lib/lesson/pack";
import type { PackIndex, SiteBundle, TimelineAnalysis } from "@/lib/lesson/types";

import { LessonSkyChart } from "./lesson-sky-chart";
import { EvidenceFold, PackBanner } from "./pack-provenance";
import { PackGate } from "./pack-gate";
import { CATALOG_SITE_NAMES, STAND_SITE_ID } from "./steps";
import { usePackResource } from "./use-pack-resource";

interface StandData {
  index: PackIndex;
  stand: SiteBundle;
  /** Timelines of every demo site, in manifest order, for the flat-horizon comparison. */
  timelines: Array<{ catalogSiteId: string; name: string; timeline: TimelineAnalysis }>;
}

/** Period 4: standing at the south pole. Every number comes from the lesson pack. */
export function StandStep() {
  const load = useCallback(async (): Promise<StandData> => {
    const index = await loadPackIndex();
    const stand = await loadSiteBundle(index, STAND_SITE_ID);
    const timelines = await Promise.all(
      index.demoTrio.map(async (site) => ({
        catalogSiteId: site.catalogSiteId,
        name: site.name,
        timeline:
          site.catalogSiteId === STAND_SITE_ID
            ? stand.timeline
            : await loadSiteTimeline(index, site.catalogSiteId),
      })),
    );
    return { index, stand, timelines };
  }, []);
  const { state, reload } = usePackResource(load);
  return (
    <PackGate state={state} reload={reload}>
      {(data) => <StandLesson data={data} />}
    </PackGate>
  );
}

function range(values: number[]): { min: number; max: number } {
  return { min: Math.min(...values), max: Math.max(...values) };
}

function StandLesson({ data }: { data: StandData }) {
  const { lang, t: messages } = useLanguage();
  const t = messages.learn.stand;
  const names = messages.learn.siteNames;
  const siteLabel = (catalogId: string) => {
    const english = CATALOG_SITE_NAMES[catalogId];
    return english ? (names[english] ?? english) : catalogId;
  };
  const { index, stand, timelines } = data;
  const profile = useMemo(() => horizonProfile(stand.horizon), [stand.horizon]);
  const tracks = useMemo(() => {
    const { sun, earth } = bodyTracks(stand.timeline);
    return [sun, earth];
  }, [stand.timeline]);
  const sunEl = range(stand.timeline.illumination.samples.map((s) => s.elevation_deg));
  const earthEl = range(stand.timeline.earth_visibility.samples.map((s) => s.elevation_deg));
  const from = formatUtcDate(index.lunation.startUtc, lang);
  const to = formatUtcDate(index.lunation.endUtc, lang);

  // The least sunlit site in the scan, if the scan found one.
  const scan = index.shadowed;
  const darkest = scan.sites.length
    ? scan.sites.reduce((a, b) => (b.sunlitFraction < a.sunlitFraction ? b : a))
    : null;

  return (
    <div className="space-y-6" data-testid="stand-step">
      <PackBanner provenance={index.provenance} />

      <section className="space-y-3" aria-labelledby="stand-chart-heading">
        <h2 id="stand-chart-heading" className="text-lg font-semibold text-foreground">
          {t.chartHeading}
        </h2>
        <p className="text-sm font-medium text-foreground" data-testid="stand-site">
          {t.siteHeading(names[stand.name] ?? stand.name)}
        </p>
        <p className="text-sm text-muted-foreground">{t.siteNote}</p>
        <p className="text-sm text-muted-foreground" data-testid="stand-window">
          {t.windowNote(from, to)}
        </p>
        <LessonSkyChart profile={profile} tracks={tracks} />
        <Legend hasLowerBounds={profile.lowerBound.azimuthDeg.length > 0} />
        <div className="rounded-md border border-border bg-panel p-3 text-sm">
          <h3 className="font-semibold text-foreground">{t.readHeading}</h3>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted-foreground">
            {t.readSteps.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </div>
        <details data-testid="stand-check" className="rounded-md border border-border bg-panel p-3 text-sm">
          <summary className="cursor-pointer font-medium text-foreground">{t.checkHeading}</summary>
          <p className="mt-2 text-muted-foreground">{t.checkNote}</p>
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">{t.sunMax}</dt>
            <dd className="numeric font-mono text-foreground" data-testid="sun-elevation-max">
              {t.degrees(sunEl.max)}
            </dd>
            <dt className="text-muted-foreground">{t.sunMin}</dt>
            <dd className="numeric font-mono text-foreground" data-testid="sun-elevation-min">
              {t.degrees(sunEl.min)}
            </dd>
            <dt className="text-muted-foreground">{t.earthMax}</dt>
            <dd className="numeric font-mono text-foreground" data-testid="earth-elevation-max">
              {t.degrees(earthEl.max)}
            </dd>
            <dt className="text-muted-foreground">{t.earthMin}</dt>
            <dd className="numeric font-mono text-foreground" data-testid="earth-elevation-min">
              {t.degrees(earthEl.min)}
            </dd>
          </dl>
        </details>
      </section>

      <section className="space-y-3" aria-labelledby="stand-sunlit-heading">
        <h2 id="stand-sunlit-heading" className="text-lg font-semibold text-foreground">
          {t.sunlitHeading}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t.sunlitIntro}</p>
        <table className="w-full table-fixed border-collapse text-sm" data-testid="sunlit-table">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th scope="col" className="w-[34%] py-2 pr-2 font-medium">
                {t.colSite}
              </th>
              <th scope="col" className="py-2 pr-2 font-medium">
                {t.colFlat}
              </th>
              <th scope="col" className="py-2 font-medium">
                {t.colTerrain}
              </th>
            </tr>
          </thead>
          <tbody>
            {[...timelines]
              .sort(
                (a, b) =>
                  Number(b.catalogSiteId === STAND_SITE_ID) - Number(a.catalogSiteId === STAND_SITE_ID),
              )
              .map(({ catalogSiteId, name, timeline }) => (
                <tr
                  key={catalogSiteId}
                  className="border-t border-border align-top"
                  data-site={catalogSiteId}
                >
                  <th scope="row" className="py-2 pr-2 text-left font-normal text-foreground">
                    {names[name] ?? name}
                  </th>
                  <td className="numeric py-2 pr-2 font-mono" data-testid={`flat-${catalogSiteId}`}>
                    {t.percent(timeline.illumination.astronomical.illuminated_fraction)}
                  </td>
                  <td className="numeric py-2 font-mono" data-testid={`terrain-${catalogSiteId}`}>
                    {timeline.illumination.terrain
                      ? t.percent(timeline.illumination.terrain.illuminated_fraction)
                      : t.terrainMissing}
                  </td>
                </tr>
              ))}
            {darkest && (
              <tr className="border-t border-border align-top" data-site={darkest.catalogSiteId}>
                <th scope="row" className="py-2 pr-2 text-left font-normal text-foreground">
                  {siteLabel(darkest.catalogSiteId)}
                </th>
                <td className="py-2 pr-2 text-muted-foreground">{t.notInPack}</td>
                <td className="numeric py-2 font-mono" data-testid="darkest-terrain">
                  {t.percent(darkest.sunlitFraction)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <EvidenceFold
          evidence={stand.timeline.illumination.evidence}
          limitations={stand.timeline.illumination.limitations}
          title={t.evidenceFor}
          testId="stand-evidence"
          kindTestId="stand-evidence-kind"
          kindLabel={`${messages.learn.compare.evidenceKinds[stand.timeline.illumination.evidence.kind] ?? ""} (${stand.timeline.illumination.evidence.kind})`}
        />
      </section>

      {darkest && (
        <section
          className="space-y-2 rounded-md border border-border bg-panel p-3 text-sm leading-relaxed"
          aria-labelledby="stand-dark-heading"
          data-testid="near-dark"
        >
          <h2 id="stand-dark-heading" className="text-lg font-semibold text-foreground">
            {t.nearDarkHeading}
          </h2>
          {scan.permanentlyShadowedExample === null && (
            <p className="text-foreground" data-testid="no-zero-site">
              {t.nearDarkNoZero(scan.sites.length)}
            </p>
          )}
          <p className="text-foreground">
            {t.nearDarkBody(siteLabel(darkest.catalogSiteId), t.percent(darkest.sunlitFraction))}
          </p>
          <p className="text-muted-foreground">{t.nearDarkNoChart}</p>
          <p className="text-muted-foreground" data-testid="near-dark-source">
            {t.nearDarkSource(
              scan.criterion,
              formatUtcDate(scan.windowStartUtc, lang),
              formatUtcDate(scan.windowEndUtc, lang),
            )}
          </p>
        </section>
      )}
    </div>
  );
}

function Legend({ hasLowerBounds }: { hasLowerBounds: boolean }) {
  const t = useLanguage().t.learn.stand;
  const items = [
    t.legend.skyline,
    ...(hasLowerBounds ? [t.legend.lowerBound] : []),
    t.legend.flat,
    t.legend.sun,
    t.legend.earth,
  ];
  return (
    <div className="text-sm text-muted-foreground" data-testid="sky-legend">
      <p className="font-medium text-foreground">{t.legendHeading}</p>
      <ul className="list-disc space-y-0.5 pl-5">
        {items.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
