import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

/**
 * T-30: the globe shows the acquired NASA texture with its provenance, and the
 * placeholder label appears only when no texture is built.
 *
 * The first two tests intercept /textures/moon/* so they are deterministic whether or not
 * this checkout has run `build-web-texture`. The intercepted image is a SYNTHETIC 2×1 PNG
 * fixture (not lunar data); only the HUD wiring is under test there. The third test runs
 * against the real built texture when it exists locally (CI does not acquire it).
 */

const MANIFEST_URL = /\/textures\/moon\/manifest\.json(\?.*)?$/;
const TEXTURE_DIR = join(__dirname, "../../../apps/web/public/textures/moon");

// 2×1 grey PNG. SYNTHETIC test fixture — not lunar data.
const SYNTHETIC_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAAAAADRSSBWAAAAC0lEQVR4nGNoaAAAAYMBARg1IhUAAAAASUVORK5CYII=",
  "base64",
);

const SYNTHETIC_SHA = "0".repeat(63) + "1";
const SYNTHETIC_MANIFEST = {
  schema_version: 1,
  kind: "lunar-color-equirectangular",
  file: "synthetic-e2e.png",
  width: 2,
  height: 1,
  projection: "equirectangular",
  source: {
    dataset_id: "nasa-svs-cgi-moon-kit",
    dataset_title: "SYNTHETIC E2E FIXTURE — not lunar data",
    file: "synthetic-e2e-source.tif",
    source_url: "https://svs.gsfc.nasa.gov/4720",
    sha256: SYNTHETIC_SHA,
    retrieved_at_utc: "2026-11-04T00:00:00Z",
  },
  credit: "Synthetic test fixture.",
  usage: "Test only.",
  assumptions: ["Projection: synthetic fixture assumption line."],
  generated_at_utc: "2026-11-04T00:00:00Z",
  generator: "e2e fixture",
};

async function serveSyntheticTexture(page: Page) {
  await page.route(MANIFEST_URL, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SYNTHETIC_MANIFEST) }),
  );
  await page.route(/\/textures\/moon\/synthetic-e2e\.png$/, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: SYNTHETIC_PNG }),
  );
}

test("placeholder label appears when no texture is built", async ({ page }) => {
  await page.route(MANIFEST_URL, (route) => route.fulfill({ status: 404, body: "not found" }));
  await page.goto("/");

  const disclosure = page.getByTestId("surface-disclosure");
  await expect(disclosure).toHaveAttribute("data-surface", "procedural");
  await expect(disclosure).toContainText("Visual placeholder");
  await expect(disclosure).toContainText("not lunar data");
  await expect(page.getByTestId("surface-provenance-trigger")).toHaveCount(0);
});

test("built texture: HUD shows its provenance and no placeholder label", async ({ page }) => {
  await serveSyntheticTexture(page);
  await page.goto("/");

  const disclosure = page.getByTestId("surface-disclosure");
  await expect(disclosure).toHaveAttribute("data-surface", "texture");
  await expect(disclosure).toHaveAttribute("data-state", "loaded");
  await expect(disclosure).toContainText("NASA SVS");
  await expect(disclosure).toContainText("synthetic-e2e-source.tif");
  await expect(page.getByText("Visual placeholder")).toHaveCount(0);

  await page.getByTestId("surface-provenance-trigger").click();
  const panel = page.getByTestId("surface-provenance");
  await expect(panel).toBeVisible();
  await expect(page.getByTestId("surface-provenance-sha256")).toHaveText(SYNTHETIC_SHA);
  await expect(panel).toContainText("SYNTHETIC E2E FIXTURE");
  await expect(panel).toContainText("2026-11-04T00:00:00Z");
  await expect(panel).toContainText("synthetic fixture assumption line");
  await expect(panel.getByRole("link", { name: /synthetic-e2e-source\.tif/ })).toHaveAttribute(
    "href",
    "https://svs.gsfc.nasa.gov/4720",
  );
});

test("built texture: falls back to the labelled placeholder when the image fails", async ({ page }) => {
  await page.route(MANIFEST_URL, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SYNTHETIC_MANIFEST) }),
  );
  await page.route(/\/textures\/moon\/synthetic-e2e\.png$/, (route) => route.fulfill({ status: 404 }));
  await page.goto("/");

  const disclosure = page.getByTestId("surface-disclosure");
  await expect(disclosure).toHaveAttribute("data-surface", "procedural");
  await expect(disclosure).toContainText("Visual placeholder");
});

test("real NASA SVS texture, when built locally, is shown with its recorded checksum", async ({ page }) => {
  const manifestPath = join(TEXTURE_DIR, "manifest.json");
  test.skip(!existsSync(manifestPath), "texture not built in this checkout (run npm run setup:texture)");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
    source: { sha256: string; file: string };
  };

  await page.goto("/");
  const disclosure = page.getByTestId("surface-disclosure");
  await expect(disclosure).toHaveAttribute("data-surface", "texture");
  await expect(disclosure).toHaveAttribute("data-state", "loaded", { timeout: 60_000 });
  await expect(disclosure).toContainText(manifest.source.file);
  await page.getByTestId("surface-provenance-trigger").click();
  await expect(page.getByTestId("surface-provenance-sha256")).toHaveText(manifest.source.sha256);
});
