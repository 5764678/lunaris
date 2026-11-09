import { describe, expect, it } from "vitest";

import {
  datasetAvailability,
  describeDataSummary,
  summarizeDatasets,
  type DatasetLike,
} from "./availability";

const MOON_KIT = "nasa-svs-cgi-moon-kit";
const SHIPPED = new Set([MOON_KIT]);
const NOTHING_SHIPPED: ReadonlySet<string> = new Set();

/** Invented list shaped like the registry: two downloads, one streamed, one visualization texture. */
function registry(statuses: {
  dem: DatasetLike["local"]["status"];
  kernels: DatasetLike["local"]["status"];
  kit: DatasetLike["local"]["status"];
}): DatasetLike[] {
  return [
    {
      id: "lola-ldem-75s-240m",
      title: "LOLA 240 m DEM",
      category: "terrain",
      local: { status: statuses.dem },
    },
    {
      id: "naif-generic-kernels-lunar",
      title: "NAIF SPICE kernels",
      category: "ephemeris",
      local: { status: statuses.kernels },
    },
    {
      id: MOON_KIT,
      title: "NASA SVS CGI Moon Kit",
      category: "visualization",
      local: { status: statuses.kit },
    },
    {
      id: "pgda-lola-20mpp-80s",
      title: "PGDA LOLA 20 m DEM",
      category: "terrain",
      local: { status: "remote_window" },
    },
  ];
}

describe("datasetAvailability", () => {
  const kit = (status: DatasetLike["local"]["status"]): DatasetLike => ({
    id: MOON_KIT,
    title: "Moon Kit",
    category: "visualization",
    local: { status },
  });

  it("treats a verified download as stored and a windowed dataset as streamed", () => {
    expect(datasetAvailability(kit("acquired"), NOTHING_SHIPPED)).toEqual({ kind: "stored" });
    expect(datasetAvailability(kit("remote_window"), NOTHING_SHIPPED)).toEqual({ kind: "streamed" });
  });

  it("counts a visualization dataset as available when the web app ships its texture", () => {
    expect(datasetAvailability(kit("missing"), SHIPPED)).toEqual({ kind: "web-texture" });
    // The server's copy being broken does not affect the picture the web app ships.
    expect(datasetAvailability(kit("incomplete"), SHIPPED)).toEqual({ kind: "web-texture" });
  });

  it("keeps a downloaded file as stored even when a texture is also shipped", () => {
    expect(datasetAvailability(kit("acquired"), SHIPPED)).toEqual({ kind: "stored" });
  });

  it("reports the server's status when nothing makes the dataset available", () => {
    expect(datasetAvailability(kit("missing"), NOTHING_SHIPPED)).toEqual({
      kind: "unavailable",
      status: "missing",
    });
    expect(datasetAvailability(kit("untracked"), NOTHING_SHIPPED)).toEqual({
      kind: "unavailable",
      status: "untracked",
    });
  });

  it("never lets a texture stand in for terrain or ephemeris data", () => {
    const dem: DatasetLike = { id: MOON_KIT, title: "x", category: "terrain", local: { status: "missing" } };
    expect(datasetAvailability(dem, SHIPPED)).toEqual({ kind: "unavailable", status: "missing" });
  });
});

describe("summarizeDatasets", () => {
  it("counts every dataset: downloaded, streamed and the shipped texture (the live site)", () => {
    const summary = summarizeDatasets(
      registry({ dem: "acquired", kernels: "acquired", kit: "missing" }),
      SHIPPED,
    );
    expect(summary).toEqual({
      total: 4,
      ready: 4,
      stored: 2,
      streamed: 1,
      textures: 1,
      notReady: [],
    });
  });

  it("names what is not ready (a server with no downloads and no shipped texture)", () => {
    const summary = summarizeDatasets(
      registry({ dem: "missing", kernels: "untracked", kit: "missing" }),
      NOTHING_SHIPPED,
    );
    expect(summary.total).toBe(4);
    expect(summary.ready).toBe(1);
    expect(summary.streamed).toBe(1);
    expect(summary.notReady).toEqual([
      { id: "lola-ldem-75s-240m", title: "LOLA 240 m DEM", status: "missing" },
      { id: "naif-generic-kernels-lunar", title: "NAIF SPICE kernels", status: "untracked" },
      { id: MOON_KIT, title: "NASA SVS CGI Moon Kit", status: "missing" },
    ]);
  });

  it("handles an empty registry", () => {
    expect(summarizeDatasets([], NOTHING_SHIPPED)).toEqual({
      total: 0,
      ready: 0,
      stored: 0,
      streamed: 0,
      textures: 0,
      notReady: [],
    });
  });
});

describe("describeDataSummary", () => {
  it("says all datasets are ready and where each kind lives", () => {
    const text = describeDataSummary(
      summarizeDatasets(registry({ dem: "acquired", kernels: "acquired", kit: "missing" }), SHIPPED),
    );
    expect(text.headline).toBe("All 4 datasets ready.");
    expect(text.where).toEqual([
      "2 stored on the server",
      "1 streamed from NASA when needed",
      "1 texture shipped with the web app",
    ]);
    expect(text.notReady).toEqual([]);
  });

  it("lists only the kinds that are present, with the right plural", () => {
    const two = new Set([MOON_KIT, "second-texture"]);
    const datasets: DatasetLike[] = [
      { id: MOON_KIT, title: "a", category: "visualization", local: { status: "missing" } },
      { id: "second-texture", title: "b", category: "visualization", local: { status: "missing" } },
    ];
    expect(describeDataSummary(summarizeDatasets(datasets, two)).where).toEqual([
      "2 textures shipped with the web app",
    ]);
  });

  it("gives a count headline and a reason for each dataset that is not ready", () => {
    const text = describeDataSummary(
      summarizeDatasets(
        registry({ dem: "acquired", kernels: "incomplete", kit: "missing" }),
        NOTHING_SHIPPED,
      ),
    );
    expect(text.headline).toBe("2 of 4 datasets ready.");
    expect(text.where).toEqual(["1 stored on the server", "1 streamed from NASA when needed"]);
    expect(text.notReady).toEqual([
      "NAIF SPICE kernels: download incomplete",
      "NASA SVS CGI Moon Kit: not downloaded on the server",
    ]);
  });

  it("never claims 'all' for an empty registry", () => {
    expect(describeDataSummary(summarizeDatasets([], NOTHING_SHIPPED)).headline).toBe(
      "0 of 0 datasets ready.",
    );
  });
});
