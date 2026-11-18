"use client";

import { useMemo, useState } from "react";

import { SKY_COLORS, SkyChart } from "@/app/illumination/_components/sky-chart";
import { bodyTracks, horizonProfile, type BodyTrack } from "@/app/illumination/_lib/model";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { loadManifest, loadSite } from "@/lib/lesson/pack";
import { nearDarkExample, skyFacts } from "@/lib/lesson/sky";
import type { LessonSite, PackManifest } from "@/lib/lesson/types";

import { EvidenceChip, EvidenceDetails } from "./evidence-parts";
import { usePackResource } from "./use-lesson-pack";

/** The standing point of period 4: the lesson plan's example, "Peak near Shackleton". */
export const SKY_SITE_ID = "pgda78-site07";

const deg = (v: number | null, digits = 1) => (v === null ? "–" : `${v.toFixed(digits)}°`);
const inView = (fraction: number | null) => (fraction ?? 0) > 0;
const pct = (v: number) => `${(v * 100).toFixed(1)} %`;
const utcDay = (iso: string) => iso.slice(0, 10);
const utcMinute = (iso: string) => iso.slice(0, 16).replace("T", " ");
const BTN = "h-11 px-4 text-sm";

/** Period 4: stand at a south-pole site and read its sky chart (sky chart, Sun low, Earth low). */
export function SkyStep() {
  const t = useT().learn;
  const site = usePackResource(`site:${SKY_SITE_ID}`, () => loadSite(SKY_SITE_ID));
  const manifest = usePackResource("manifest", () => loadManifest());

  if (site.state.status === "loading" || manifest.state.status === "loading") {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {t.sky.loading}
      </p>
    );
  }
  if (site.state.status === "error" || manifest.state.status === "error") {
    const message =
      site.state.status === "error"
        ? site.state.message
        : manifest.state.status === "error"
          ? manifest.state.message
          : "";
    return (
      <div role="alert" className="space-y-2 rounded-md border border-critical p-3 text-sm">
        <p className="font-medium text-critical">{t.pack.error}</p>
        <p lang="en" className="text-muted-foreground">
          {message}
        </p>
        <Button
          type="button"
          variant="outline"
          className={BTN}
          onClick={() => {
            site.reload();
            manifest.reload();
          }}
        >
          {t.pack.retry}
        </Button>
      </div>
    );
  }
  return <SkyLesson site={site.state.data} manifest={manifest.state.data} />;
}

function SkyLesson({ site, manifest }: { site: LessonSite; manifest: PackManifest }) {
  const t = useT().learn;
  const s = t.sky;
  const facts = useMemo(() => skyFacts(site), [site]);
  const profile = useMemo(() => horizonProfile(site.horizon), [site]);
  const tracks = useMemo<BodyTrack[]>(() => {
    const { sun, earth } = bodyTracks(site.timeline);
    return [sun, earth];
  }, [site]);
  const nearDark = useMemo(() => nearDarkExample(manifest), [manifest]);
  const [hour, setHour] = useState(0);

  const sunSamples = site.timeline.illumination.samples;
  const earthSamples = site.timeline.earth_visibility.samples;
  const i = Math.min(hour, sunSamples.length - 1);
  const sun = sunSamples[i]!;
  const earth = earthSamples[i]!;
  const win = manifest.lunation.window;
  const illumination = site.timeline.illumination;

  return (
    <div className="space-y-5" data-testid="sky-lesson">
      <section className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">{s.heading}</h2>
        <p data-testid="sky-site" className="text-sm text-foreground">
          {s.siteLine(site.name)}
        </p>
        <p className="text-sm text-muted-foreground">{s.siteNote}</p>
        <p className="text-sm text-muted-foreground">
          {s.windowNote(utcDay(win.start_utc), utcDay(win.end_utc))}
        </p>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <section className="space-y-2">
          <h3 className="font-semibold text-foreground">{s.chartHeading}</h3>
          <div className="overflow-hidden rounded-md border border-border bg-panel-sunken p-2">
            <SkyChart profile={profile} tracks={tracks} />
          </div>
          <ul
            className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground"
            aria-label={s.chartHeading}
          >
            <li className="flex items-center gap-1.5">
              <span
                className="inline-block size-3 rounded-full"
                style={{ background: SKY_COLORS.sun }}
                aria-hidden="true"
              />
              {s.legendSun}
            </li>
            <li className="flex items-center gap-1.5">
              <span
                className="inline-block size-3 rounded-full"
                style={{ background: SKY_COLORS.earth }}
                aria-hidden="true"
              />
              {s.legendEarth}
            </li>
            <li className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-5 rounded-sm"
                style={{ background: SKY_COLORS.terrain }}
                aria-hidden="true"
              />
              {s.legendSkyline}
            </li>
          </ul>
          <p className="text-sm leading-relaxed text-muted-foreground">{s.chartHelp}</p>
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold text-foreground">{s.factsHeading}</h3>
          <ul
            data-testid="sky-facts"
            className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground"
          >
            <li data-testid="fact-sun">
              {s.sunRange(deg(facts.sunElevationMaxDeg), deg(facts.sunElevationMinDeg))}
            </li>
            <li data-testid="fact-earth">
              {s.earthRange(
                deg(facts.earthElevationMinDeg),
                deg(facts.earthElevationMaxDeg),
                deg(facts.earthAzimuthMinDeg, 0),
                deg(facts.earthAzimuthMaxDeg, 0),
              )}
            </li>
            <li data-testid="fact-skyline">
              {s.skylineRange(deg(facts.skylineMinDeg), deg(facts.skylineMaxDeg))}
            </li>
          </ul>
          <p className="text-sm leading-relaxed text-muted-foreground">{s.lowSun}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{s.earthGeometric}</p>
        </section>
      </div>

      <section className="space-y-2 rounded-md border border-border bg-panel p-3">
        <h3 className="font-semibold text-foreground">{s.sunlitHeading}</h3>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{s.withTerrain}</dt>
            <dd data-testid="sunlit-terrain" className="numeric text-2xl font-semibold text-foreground">
              {pct(facts.sunlitTerrain)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{s.flatHorizon}</dt>
            <dd data-testid="sunlit-flat" className="numeric text-2xl font-semibold text-foreground">
              {pct(facts.sunlitFlat)}
            </dd>
          </div>
        </dl>
        <p className="text-sm leading-relaxed text-muted-foreground">{s.sunlitExplain}</p>
        <p className="text-sm text-muted-foreground">
          {s.sunlitEvidence}: <EvidenceChip kind={illumination.evidence.kind} testId="sunlit-evidence" />
        </p>
        <EvidenceDetails evidence={illumination.evidence} limitations={illumination.limitations} />
      </section>

      <section className="space-y-2 rounded-md border border-border bg-panel p-3">
        <h3 className="font-semibold text-foreground">{s.hourHeading}</h3>
        <p className="numeric text-sm text-muted-foreground">
          {s.hourLabel}: <span data-testid="sky-epoch">{utcMinute(sun.epoch_utc)}</span>
        </p>
        <input
          type="range"
          min={0}
          max={sunSamples.length - 1}
          step={1}
          value={i}
          onChange={(e) => setHour(Number(e.target.value))}
          aria-label={s.hourSlider}
          data-testid="sky-slider"
          className="h-8 w-full accent-primary"
        />
        <p
          data-testid="hour-sun"
          data-visible={inView(sun.terrain_visible_fraction)}
          className="text-sm leading-relaxed text-foreground"
        >
          {s.hourSun(deg(sun.azimuth_deg, 0), deg(sun.elevation_deg), deg(sun.terrain_horizon_elevation_deg))}
          {" · "}
          <strong>{inView(sun.terrain_visible_fraction) ? s.visible : s.hidden}</strong>
        </p>
        <p
          data-testid="hour-earth"
          data-visible={inView(earth.terrain_visible_fraction)}
          className="text-sm leading-relaxed text-foreground"
        >
          {s.hourEarth(
            deg(earth.azimuth_deg, 0),
            deg(earth.elevation_deg),
            deg(earth.terrain_horizon_elevation_deg),
          )}
          {" · "}
          <strong>{inView(earth.terrain_visible_fraction) ? s.visible : s.hidden}</strong>
        </p>
      </section>

      <section data-testid="near-dark" className="space-y-1.5 rounded-md border border-border bg-panel p-3">
        <h3 className="font-semibold text-foreground">{s.nearDarkHeading}</h3>
        {nearDark ? (
          <>
            <p className="text-sm leading-relaxed text-foreground">
              {s.nearDarkBody(nearDark.name, pct(nearDark.sunlitFraction), nearDark.scannedSites)}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">{s.nearDarkNotZero}</p>
            <p data-testid="near-dark-source" className="text-sm leading-relaxed text-muted-foreground">
              {s.nearDarkSource(
                utcDay(nearDark.windowStartUtc),
                utcDay(nearDark.windowEndUtc),
                nearDark.criterion,
              )}
            </p>
            <p className="text-sm text-muted-foreground">{s.nearDarkNoChart}</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{s.nearDarkUnavailable}</p>
        )}
      </section>

      <p className="text-sm leading-relaxed text-muted-foreground">{s.tanNote}</p>
    </div>
  );
}
