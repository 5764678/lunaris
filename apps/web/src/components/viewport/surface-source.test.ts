import { describe, expect, it } from "vitest";

import { isHttpsUrl, isTextureManifest, type TextureManifest } from "./surface-source";

/**
 * Shape of the manifest written by `uv run lunaris-data build-web-texture`. The values
 * mirror a real build (SVS 4720, `lroc_color_poles_4k.tif`); the test only checks shape.
 */
function manifest(): TextureManifest {
  return {
    schema_version: 1,
    kind: "lunar-color-equirectangular",
    file: "moon-color.jpg",
    width: 4096,
    height: 2048,
    projection: "equirectangular",
    longitude_min_deg: -180,
    longitude_max_deg: 180,
    latitude_min_deg: -90,
    latitude_max_deg: 90,
    source: {
      dataset_id: "nasa-svs-cgi-moon-kit",
      dataset_title: "NASA SVS CGI Moon Kit — global color map (visualization only)",
      file: "lroc_color_poles_4k.tif",
      source_url: "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_4k.tif",
      sha256: "918649a7f8ed2f1329b2cd95bb0d25483befdcb60ae1a66db681a637cc21344f",
      retrieved_at_utc: "2026-11-04T11:18:47.424899Z",
    },
    credit: "NASA's Scientific Visualization Studio.",
    usage: "Visualization only — not an analysis input.",
    assumptions: ["Projection: LUNARIS ASSUMES simple cylindrical (equirectangular)."],
    generated_at_utc: "2026-11-04T11:18:48.245967Z",
    generator: "lunaris-data 0.1.0",
  };
}

describe("isTextureManifest", () => {
  it("accepts the builder's manifest", () => {
    expect(isTextureManifest(manifest())).toBe(true);
  });

  it.each([
    ["path traversal in file", (m: Record<string, unknown>) => (m.file = "../secret.jpg")],
    ["wrong schema version", (m: Record<string, unknown>) => (m.schema_version = 2)],
    ["unknown projection", (m: Record<string, unknown>) => (m.projection = "polar-stereographic")],
    ["non-integer width", (m: Record<string, unknown>) => (m.width = 40.5)],
    ["missing credit", (m: Record<string, unknown>) => delete m.credit],
    ["assumptions not a list", (m: Record<string, unknown>) => (m.assumptions = "none")],
  ])("rejects %s", (_name, mutate) => {
    const m = manifest() as unknown as Record<string, unknown>;
    mutate(m);
    expect(isTextureManifest(m)).toBe(false);
  });

  it("rejects a source it could not state", () => {
    for (const key of ["dataset_title", "file", "source_url", "sha256", "retrieved_at_utc"] as const) {
      const m = manifest();
      delete (m.source as Partial<TextureManifest["source"]>)[key];
      expect(isTextureManifest(m), key).toBe(false);
    }
  });

  it("rejects a malformed checksum and a non-https source URL", () => {
    const short = manifest();
    short.source.sha256 = "918649a7";
    expect(isTextureManifest(short)).toBe(false);
    const script = manifest();
    script.source.source_url = "javascript:alert(1)";
    expect(isTextureManifest(script)).toBe(false);
  });

  it("rejects non-objects", () => {
    for (const value of [null, undefined, 1, "manifest", []]) expect(isTextureManifest(value)).toBe(false);
  });
});

describe("isHttpsUrl", () => {
  it("accepts https only", () => {
    expect(isHttpsUrl("https://svs.gsfc.nasa.gov/4720")).toBe(true);
    expect(isHttpsUrl("http://svs.gsfc.nasa.gov/4720")).toBe(false);
    expect(isHttpsUrl("/textures/moon/manifest.json")).toBe(false);
    expect(isHttpsUrl(42)).toBe(false);
  });
});
