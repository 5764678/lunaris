import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * The Compare table has 12 metric columns. It must use the whole width of the page, and when the
 * columns still do not fit it must say so (faded right edge and a "More columns" button) instead of
 * quietly cutting off the last column. Serves a SYNTHETIC comparison with the same 12 columns as the
 * real API for the real registered demo trio; the values are invented, not lunar results.
 */

const API = "http://localhost:8100";
const COMPARE = /\/api\/v1\/analysis\/site-comparison\?/;
const SHA = "a".repeat(64);

const COLUMNS = [
  ["surface_height_m", "Height", "m"],
  ["slope_at_site_deg", "Slope at site", "deg"],
  ["slope_p95_deg", "Slope p95 (footprint)", "deg"],
  ["roughness_rms_m", "Roughness", "m"],
  ["horizon_min_deg", "Horizon min", "deg"],
  ["horizon_max_deg", "Horizon max", "deg"],
  ["horizon_truncated_azimuths", "Truncated azimuths", "count"],
  ["sun_mean_visible_disk_fraction", "Sun: mean visible disk", "fraction"],
  ["sun_illuminated_fraction", "Sun: illuminated", "fraction"],
  ["sun_longest_hidden_s", "Sun: longest darkness", "s"],
  ["earth_visible_fraction", "Earth: visible", "fraction"],
  ["earth_longest_outage_s", "Earth: longest outage", "s"],
] as const;

const evidence = (statement: string) => ({
  kind: "calculation",
  statement: `SYNTHETIC E2E FIXTURE — ${statement}`,
  sources: [
    {
      source_id: "pgda-lola-20mpp-80s",
      title: "Synthetic DEM source",
      url: "https://pgda.gsfc.nasa.gov/products/90",
      version: null,
      sha256: SHA,
      citation: "Synthetic citation.",
    },
  ],
  method: "synthetic method",
  assumptions: [],
});

function syntheticComparison(url: string) {
  const ids = new URL(url).searchParams.get("site_ids")!.split(",");
  return {
    start_utc: "2027-01-01T00:00:00Z",
    end_utc: "2028-01-01T00:00:00Z",
    step_s: 3600,
    sample_count: 8761,
    observer_height_m: 2,
    footprint_radius_m: 50,
    assumptions: [],
    columns: COLUMNS.map(([key, label, unit]) => ({ key, label, unit, description: label })),
    rows: ids.map((id, i) => ({
      site_id: id,
      name: `row-${i}`,
      origin: "published",
      latitude_deg: -89,
      longitude_deg: 10 * i,
      ...Object.fromEntries(
        COLUMNS.map(([key, , unit]) => [
          key,
          { value: 1.5, unit, baseline_m: null, reason: null, evidence: evidence(key), limitations: [] },
        ]),
      ),
    })),
  };
}

async function registerTrio(request: APIRequestContext) {
  const response = await request.post(`${API}/api/v1/catalog/demo-trio/register`);
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { sites: { id: string }[] }).sites.map((s) => s.id);
}

async function cleanup(request: APIRequestContext, ids: string[]) {
  for (const id of ids) await request.delete(`${API}/api/v1/sites/${id}`);
}

test.describe("laptop width", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("says that columns are hidden, and the button reveals the last one", async ({ page, request }) => {
    const ids = await registerTrio(request);
    try {
      await page.route(COMPARE, (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(syntheticComparison(route.request().url())),
        }),
      );
      await page.goto("/compare");
      await expect(page.getByTestId("compare-row")).toHaveCount(3);

      const box = page.getByTestId("compare-scroll");
      const more = page.getByTestId("compare-scroll-more");
      await expect(box).toHaveAttribute("data-scroll-state", "more");
      await expect(more).toBeVisible();

      // Reachable and named for keyboard and screen-reader users.
      await expect(page.getByRole("region", { name: "Comparison table (scrolls sideways)" })).toBeVisible();
      await box.focus();
      await expect(box).toBeFocused();

      await more.click();
      await expect(box).toHaveAttribute("data-scroll-state", "end");
      await expect(more).toBeHidden();

      // The last column is now fully inside the box.
      const boxBounds = (await box.boundingBox())!;
      const lastHeader = (await page.locator('[data-testid="compare-table"] thead th').last().boundingBox())!;
      expect(lastHeader.x + lastHeader.width).toBeLessThanOrEqual(boxBounds.x + boxBounds.width + 1);
    } finally {
      await cleanup(request, ids);
    }
  });
});

test.describe("desktop width", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test("the table box is as wide as the page allows, not capped at a fixed width", async ({
    page,
    request,
  }) => {
    const ids = await registerTrio(request);
    try {
      await page.route(COMPARE, (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(syntheticComparison(route.request().url())),
        }),
      );
      await page.goto("/compare");
      await expect(page.getByTestId("compare-row")).toHaveCount(3);
      const gap = await page.evaluate(() => {
        const main = document.getElementById("workspace")!.getBoundingClientRect();
        const box = document.querySelector('[data-testid="compare-scroll"]')!.getBoundingClientRect();
        return { left: box.left - main.left, right: main.right - box.right };
      });
      // Only the page padding (16 to 24 px) on each side.
      expect(gap.left).toBeLessThanOrEqual(32);
      expect(gap.right).toBeLessThanOrEqual(32);
    } finally {
      await cleanup(request, ids);
    }
  });
});

test.describe("wide screen", () => {
  test.use({ viewport: { width: 2240, height: 1000 } });

  test("shows all 12 columns at once, with no scroll button", async ({ page, request }) => {
    const ids = await registerTrio(request);
    try {
      await page.route(COMPARE, (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(syntheticComparison(route.request().url())),
        }),
      );
      await page.goto("/compare");
      await expect(page.getByTestId("compare-row")).toHaveCount(3);
      await expect(page.getByTestId("compare-scroll")).toHaveAttribute("data-scroll-state", "fits");
      await expect(page.getByTestId("compare-scroll-more")).toHaveCount(0);

      const boxBounds = (await page.getByTestId("compare-scroll").boundingBox())!;
      const lastHeader = (await page.locator('[data-testid="compare-table"] thead th').last().boundingBox())!;
      expect(lastHeader.x + lastHeader.width).toBeLessThanOrEqual(boxBounds.x + boxBounds.width + 1);
    } finally {
      await cleanup(request, ids);
    }
  });
});
