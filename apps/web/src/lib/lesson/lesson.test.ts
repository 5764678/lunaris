import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { bodyFixedToScene } from "@/lib/geo/selenographic";

import { earthViewPose } from "./earth-view";
import { buildSyntheticPack, SYNODIC_DAYS } from "./fixtures/synthetic-pack";
import {
  LessonPackError,
  loadLessonPack,
  PACK_BASE,
  PACK_FILES,
  packPathFor,
  resetLessonPackCache,
} from "./pack";
import { phaseName, PHASE_BANDS, readoutFor, type PhaseName } from "./phase";
import { frameAt, indexSunByEpoch, samplesPerDay, totalDays } from "./series";

afterEach(resetLessonPackCache);

describe("phase names (PLAN.md section 6)", () => {
  it("names the eight phases from the lit fraction and waxing", () => {
    expect(phaseName(0, true)).toBe("new");
    expect(phaseName(0.2, true)).toBe("waxingCrescent");
    expect(phaseName(0.5, true)).toBe("firstQuarter");
    expect(phaseName(0.8, true)).toBe("waxingGibbous");
    expect(phaseName(1, true)).toBe("full");
    expect(phaseName(0.8, false)).toBe("waningGibbous");
    expect(phaseName(0.5, false)).toBe("lastQuarter");
    expect(phaseName(0.2, false)).toBe("waningCrescent");
  });

  it("uses the documented band edges", () => {
    expect(phaseName(PHASE_BANDS.newBelow - 1e-9, false)).toBe("new");
    expect(phaseName(PHASE_BANDS.newBelow, true)).toBe("waxingCrescent");
    expect(phaseName(PHASE_BANDS.halfFrom, true)).toBe("firstQuarter");
    expect(phaseName(PHASE_BANDS.halfUpTo, true)).toBe("firstQuarter");
    expect(phaseName(PHASE_BANDS.fullFrom, true)).toBe("full");
  });

  it("rounds the percentage to a whole number", () => {
    const pack = buildSyntheticPack("test");
    const readout = readoutFor({ ...pack.phase.samples[0]!, illuminated_fraction: 0.4949, waxing: true });
    expect(readout.percentLit).toBe(49);
  });
});

describe("synthetic fixture", () => {
  const pack = buildSyntheticPack("test");

  it("is labelled synthetic with the reason, and its evidence is a placeholder", () => {
    expect(pack.provenance).toEqual({ kind: "synthetic", reason: "test" });
    expect(pack.phase.evidence.kind).toBe("placeholder");
    expect(pack.sun.evidence.kind).toBe("placeholder");
    expect(pack.phase.evidence.statement).toMatch(/SYNTHETIC/);
  });

  it("starts at new Moon, is full at mid-lunation, and waxes then wanes", () => {
    const s = pack.phase.samples;
    expect(s[0]!.illuminated_fraction).toBeCloseTo(0, 6);
    const mid = s[Math.round((SYNODIC_DAYS / 2) * 24)]!;
    expect(mid.illuminated_fraction).toBeGreaterThan(0.99);
    expect(s[Math.round(SYNODIC_DAYS * 0.25 * 24)]!.waxing).toBe(true);
    expect(s[Math.round(SYNODIC_DAYS * 0.75 * 24)]!.waxing).toBe(false);
  });

  it("goes through all eight names in order over one lunation", () => {
    const names: PhaseName[] = [];
    for (const sample of pack.phase.samples) {
      const n = readoutFor(sample).name;
      if (names[names.length - 1] !== n) names.push(n);
    }
    // New Moon appears at the start and again at the end of the series.
    expect(names.slice(0, 8)).toEqual([
      "new",
      "waxingCrescent",
      "firstQuarter",
      "waxingGibbous",
      "full",
      "waningGibbous",
      "lastQuarter",
      "waningCrescent",
    ]);
  });

  it("matches Sun and phase samples by epoch", () => {
    const byEpoch = indexSunByEpoch(pack);
    const frame = frameAt(pack, 100, byEpoch)!;
    expect(frame.phase.epoch_utc).toBe(pack.sun.samples[100]!.epoch_utc);
    expect(frame.day).toBe(Math.floor(100 / samplesPerDay(3600)) + 1);
    expect(totalDays(pack)).toBe(30);
    // A Sun series on another grid yields no frame rather than a wrong Sun.
    const shifted = {
      ...pack,
      sun: {
        ...pack.sun,
        samples: pack.sun.samples.map((x) => ({ ...x, epoch_utc: "1999-01-01T00:00:00Z" })),
      },
    };
    expect(frameAt(shifted, 0, indexSunByEpoch(shifted))).toBeNull();
  });
});

describe("Earth-view camera (D12)", () => {
  it("looks from the Earth side with lunar north up", () => {
    const pose = earthViewPose([1, 0, 0]);
    expect(pose.direction).toEqual(bodyFixedToScene([1, 0, 0]));
    expect(pose.up[0]).toBeCloseTo(0);
    expect(pose.up[1]).toBeCloseTo(1);
    expect(pose.up[2]).toBeCloseTo(0);
  });

  it("keeps up perpendicular to the view direction and on the north side", () => {
    const lat = (6 * Math.PI) / 180;
    const pose = earthViewPose([Math.cos(lat) * 3, Math.sin(0.1) * 3, Math.sin(lat) * 3]);
    const dot =
      pose.direction[0] * pose.up[0] + pose.direction[1] * pose.up[1] + pose.direction[2] * pose.up[2];
    expect(dot).toBeCloseTo(0, 9);
    expect(Math.hypot(...pose.up)).toBeCloseTo(1, 9);
    expect(pose.up[1]).toBeGreaterThan(0.99);
  });

  it("rejects a zero direction", () => {
    expect(() => earthViewPose([0, 0, 0])).toThrow(RangeError);
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("pack loader", () => {
  const good = buildSyntheticPack("x");
  const route = (table: Record<string, Response>) => async (url: string) => {
    const file = url.replace(`${PACK_BASE}/`, "");
    const r = table[file];
    return r ? r.clone() : new Response("nope", { status: 404 });
  };
  const manifest = {
    pack_version: "1",
    generated_at_utc: "2026-11-17T13:37:53Z",
    code: { commit: "abc" },
    files: [
      { path: "ephemeris/sun.json", model: "SunDirectionSeries" },
      { path: "ephemeris/moon-phase.json", model: "MoonPhaseSeries" },
    ],
  };

  it("reads the pack, finding each file by the model name in the manifest", async () => {
    const pack = await loadLessonPack(
      route({
        [PACK_FILES.manifest]: jsonResponse(manifest),
        "ephemeris/sun.json": jsonResponse(good.sun),
        "ephemeris/moon-phase.json": jsonResponse(good.phase),
      }),
    );
    expect(pack.provenance).toEqual({
      kind: "pack",
      version: "1",
      generatedAtUtc: "2026-11-17T13:37:53Z",
      codeCommit: "abc",
    });
    const moved = {
      ...manifest,
      files: [
        { path: "x/phase.json", model: "MoonPhaseSeries" },
        { path: "x/sun.json", model: "SunDirectionSeries" },
      ],
    };
    const again = await loadLessonPack(
      route({
        [PACK_FILES.manifest]: jsonResponse(moved),
        "x/sun.json": jsonResponse(good.sun),
        "x/phase.json": jsonResponse(good.phase),
      }),
    );
    expect(again.phase.samples.length).toBe(good.phase.samples.length);
  });

  it("ignores a manifest path that could leave the pack folder", () => {
    const bad = { files: [{ path: "../../secret.json", model: "MoonPhaseSeries" }] };
    expect(packPathFor(bad, "MoonPhaseSeries", "ephemeris/moon-phase.json")).toBe(
      "ephemeris/moon-phase.json",
    );
  });

  it("is an error, never made-up numbers, when the pack is absent, a file is missing, or a file is malformed", async () => {
    await expect(loadLessonPack(route({}))).rejects.toBeInstanceOf(LessonPackError);
    await expect(
      loadLessonPack(route({ [PACK_FILES.manifest]: new Response("x", { status: 500 }) })),
    ).rejects.toThrow(/500/);
    await expect(
      loadLessonPack(
        route({
          [PACK_FILES.manifest]: jsonResponse(manifest),
          "ephemeris/sun.json": jsonResponse(good.sun),
        }),
      ),
    ).rejects.toThrow(/moon-phase.json answered HTTP 404/);
    await expect(
      loadLessonPack(
        route({
          [PACK_FILES.manifest]: jsonResponse(manifest),
          "ephemeris/sun.json": jsonResponse(good.sun),
          "ephemeris/moon-phase.json": jsonResponse({ frame: "MOON_ME" }),
        }),
      ),
    ).rejects.toThrow(/Moon phase series/);
  });
});

describe("the committed lesson pack (apps/web/public/lesson-pack/v1)", () => {
  const dir = join(__dirname, "../../../public/lesson-pack/v1");
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  const fromDisk = async (url: string) => {
    try {
      return new Response(readFileSync(join(dir, url.replace(`${PACK_BASE}/`, ""))));
    } catch {
      return new Response("nope", { status: 404 });
    }
  };

  it("matches the hashes in its manifest for the files the lesson reads", () => {
    for (const model of ["SunDirectionSeries", "MoonPhaseSeries"]) {
      const entry = manifest.files.find((f: { model: string }) => f.model === model);
      expect(entry, model).toBeTruthy();
      const bytes = readFileSync(join(dir, entry.path));
      expect(createHash("sha256").update(bytes).digest("hex"), entry.path).toBe(entry.sha256);
    }
  });

  it("loads, lines the Sun and phase series up by epoch, and names all eight phases in order", async () => {
    const pack = await loadLessonPack(fromDisk);
    expect(pack.provenance.kind).toBe("pack");
    expect(pack.phase.viewpoint).toBe("geocentric");
    expect(pack.phase.samples[0]!.epoch_utc).toBe("2027-01-07T20:00:00Z");
    expect(pack.phase.sample_count).toBe(pack.phase.samples.length);
    const byEpoch = indexSunByEpoch(pack);
    for (let i = 0; i < pack.phase.samples.length; i++) {
      expect(frameAt(pack, i, byEpoch), `frame ${i}`).not.toBeNull();
    }
    const names: PhaseName[] = [];
    for (const sample of pack.phase.samples) {
      const n = readoutFor(sample).name;
      if (names[names.length - 1] !== n) names.push(n);
    }
    expect(names).toEqual([
      "new",
      "waxingCrescent",
      "firstQuarter",
      "waxingGibbous",
      "full",
      "waningGibbous",
      "lastQuarter",
      "waningCrescent",
      "new",
    ]);
    expect(totalDays(pack)).toBe(30);
  });

  it("agrees with the manifest's principal phases to within the teaching bands", async () => {
    const pack = await loadLessonPack(fromDisk);
    const at = (epoch: string) =>
      pack.phase.samples.reduce((best, s) =>
        Math.abs(Date.parse(s.epoch_utc) - Date.parse(epoch)) <
        Math.abs(Date.parse(best.epoch_utc) - Date.parse(epoch))
          ? s
          : best,
      );
    const expected: Record<string, PhaseName> = {
      new_moon: "new",
      first_quarter: "firstQuarter",
      full_moon: "full",
      last_quarter: "lastQuarter",
    };
    for (const p of manifest.lunation.principal_phases as { phase: string; epoch_utc: string }[]) {
      expect(readoutFor(at(p.epoch_utc)).name, p.phase).toBe(expected[p.phase]);
    }
  });
});

/** Static guards for lesson code: contract L3 and decision D14. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("lesson code rules", () => {
  const root = join(__dirname, "../..");
  const files = [
    ...sourceFiles(join(root, "lib/lesson")),
    ...sourceFiles(join(root, "components/lesson")),
    ...sourceFiles(join(root, "app/learn")),
  ];

  it("finds the lesson files", () => {
    expect(files.length).toBeGreaterThan(8);
  });

  it("never imports the API client or queries (L3)", () => {
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/from\s+["']@\/lib\/api\/(client|queries|waking)["']/);
      expect(text, file).not.toMatch(/useSitesQuery|useSunDirection|useTerrainScene|useGlobeSun|camera-rig/);
    }
  });

  it("writes no literal colour (D14): theme tokens only", () => {
    for (const file of files) {
      const text = readFileSync(file, "utf8").replace(/0x000000/g, "");
      expect(text, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(text, file).not.toMatch(/\b(rgb|rgba|hsl|oklch)\(/);
      expect(text, file).not.toMatch(
        /\b(?:bg|text|border|ring|fill|stroke)-(?:white|black|(?:red|blue|green|gray|slate|zinc|amber|orange|yellow)-\d+)/,
      );
    }
  });
});
