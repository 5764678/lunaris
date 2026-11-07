import { expect, test, type Page } from "@playwright/test";

/**
 * The top-bar data chip says whether the data the application needs is available, not how many
 * files the server has downloaded. A dataset is ready when it is downloaded to the server,
 * streamed from NASA on demand, or (the Moon texture) shipped with the web app.
 *
 * The real dataset list is fetched from the API and its statuses are set here, so the tests do
 * not depend on what this checkout has downloaded. The texture is a SYNTHETIC fixture (see
 * globe-texture.spec.ts), not lunar data.
 */

const DATASETS = /\/api\/v1\/datasets$/;
const MANIFEST_URL = /\/textures\/moon\/manifest\.json(\?.*)?$/;
const MOON_KIT = "nasa-svs-cgi-moon-kit";

// 2×1 grey PNG. SYNTHETIC test fixture — not lunar data.
const SYNTHETIC_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAAAAADRSSBWAAAAC0lEQVR4nGNoaAAAAYMBARg1IhUAAAAASUVORK5CYII=",
  "base64",
);
const SYNTHETIC_MANIFEST = {
  schema_version: 1,
  kind: "lunar-color-equirectangular",
  file: "synthetic-e2e.png",
  width: 2,
  height: 1,
  projection: "equirectangular",
  source: {
    dataset_id: MOON_KIT,
    dataset_title: "SYNTHETIC E2E FIXTURE — not lunar data",
    file: "synthetic-e2e-source.tif",
    source_url: "https://svs.gsfc.nasa.gov/4720",
    sha256: "0".repeat(63) + "1",
    retrieved_at_utc: "2026-11-04T00:00:00Z",
  },
  credit: "Synthetic test fixture.",
  usage: "Test only.",
  assumptions: ["Projection: synthetic fixture assumption line."],
  generated_at_utc: "2026-11-04T00:00:00Z",
  generator: "e2e fixture",
};

interface DatasetJson {
  id: string;
  title: string;
  category: string;
  local: { status: string };
}

/** Serve the real dataset list with each download-type dataset set to `status`. */
async function serveDatasets(page: Page, status: "acquired" | "missing") {
  await page.route(DATASETS, async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { datasets: DatasetJson[] };
    for (const dataset of body.datasets) {
      // The 20 m DEM is streamed ("remote_window"); the Moon Kit is the visualization dataset.
      if (dataset.local.status !== "remote_window" && dataset.category !== "visualization") {
        dataset.local.status = status;
      } else if (dataset.category === "visualization") {
        dataset.local.status = "missing";
      }
    }
    await route.fulfill({ response, json: body });
  });
}

async function serveTexture(page: Page, shipped: boolean) {
  if (!shipped) {
    await page.route(MANIFEST_URL, (route) => route.fulfill({ status: 404, body: "not found" }));
    return;
  }
  await page.route(MANIFEST_URL, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SYNTHETIC_MANIFEST) }),
  );
  await page.route(/\/textures\/moon\/synthetic-e2e\.png$/, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: SYNTHETIC_PNG }),
  );
}

test("reads all ready, in green, when downloads, the streamed DEM and the shipped texture are counted", async ({
  page,
}) => {
  await serveDatasets(page, "acquired");
  await serveTexture(page, true);
  await page.goto("/");

  const chip = page.getByTestId("data-status");
  await expect(chip).toHaveAttribute("data-state", "ready");
  await expect(chip).toHaveText(/Data\s*(\d+)\/\1 ready/); // n/n, whatever n is
  await expect(chip).not.toContainText("acquired");

  await chip.hover();
  const tip = page.getByRole("tooltip");
  await expect(tip).toContainText(/All \d+ datasets ready\./);
  await expect(tip).toContainText(/\d+ stored on the server/);
  await expect(tip).toContainText("1 streamed from NASA when needed");
  await expect(tip).toContainText("1 texture shipped with the web app");
  await expect(tip).not.toContainText("not downloaded");

  // The side panel and the Data page agree: the Moon texture is "In web app", not "Missing".
  await expect(page.getByTestId("data-source-list").locator('[data-status="web_texture"]')).toHaveCount(1);
  await chip.click();
  await expect(page).toHaveURL(/\/data$/);
  const card = page.getByTestId("dataset-card").filter({ hasText: MOON_KIT });
  await expect(card.locator("[data-status]").first()).toHaveAttribute("data-status", "web_texture");
  await expect(card).toContainText("In web app");
  await expect(card).toContainText("original file not stored on the server");
  await expect(page.locator('[data-testid="dataset-card"] [data-status="missing"]')).toHaveCount(0);
});

test("reads partly ready, in amber, and names each dataset that is not ready", async ({ page, request }) => {
  const list = (await (await request.get("http://localhost:8100/api/v1/datasets")).json()) as {
    datasets: DatasetJson[];
  };
  const streamed = list.datasets.filter((d) => d.local.status === "remote_window").length;
  await serveDatasets(page, "missing");
  await serveTexture(page, false);
  await page.goto("/");

  const chip = page.getByTestId("data-status");
  await expect(chip).toHaveAttribute("data-state", "partial");
  // Only the streamed DEM counts: nothing is downloaded and no texture is shipped.
  await expect(chip).toHaveText(`Data${streamed}/${list.datasets.length} ready`);

  await chip.hover();
  const tip = page.getByRole("tooltip");
  await expect(tip).toContainText(`${streamed} of ${list.datasets.length} datasets ready.`);
  await expect(tip).toContainText("1 streamed from NASA when needed");
  for (const dataset of list.datasets.filter((d) => d.local.status !== "remote_window")) {
    await expect(tip).toContainText(`${dataset.title}: not downloaded on the server`);
  }
  await expect(tip).not.toContainText("shipped with the web app");

  await chip.click();
  const card = page.getByTestId("dataset-card").filter({ hasText: MOON_KIT });
  await expect(card.locator("[data-status]").first()).toHaveAttribute("data-status", "missing");
  await expect(card).not.toContainText("In web app");
});

test("says unavailable, in red, when the dataset list cannot be loaded", async ({ page }) => {
  await page.route(DATASETS, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "unavailable", message: "Dataset list down (e2e).", details: [], request_id: "e2e" },
      }),
    }),
  );
  await serveTexture(page, false);
  await page.goto("/");

  const chip = page.getByTestId("data-status");
  await expect(chip).toHaveAttribute("data-state", "unavailable", { timeout: 15_000 });
  await expect(chip).toContainText("unavailable");
});
