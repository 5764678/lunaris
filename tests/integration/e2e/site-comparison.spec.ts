import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * T-34: site comparison table. Deterministic tests serve a SYNTHETIC comparison (labelled
 * in every evidence statement; not lunar results) for the real registered demo trio; one
 * test runs against the live API in whatever state it is.
 */

const API = "http://localhost:8100";
const COMPARE = /\/api\/v1\/analysis\/site-comparison\?/;

const SHA = "a".repeat(64);
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
  assumptions: ["synthetic assumption"],
});

// [key, the API's technical label, unit, the plain-language label the page shows]
const COLUMNS = [
  ["surface_height_m", "Height", "m", "Height"],
  ["slope_at_site_deg", "Slope at site", "deg", "Slope at site"],
  ["roughness_rms_m", "Roughness", "m", "Bumpiness"],
  ["sun_mean_visible_disk_fraction", "Sun: mean visible disk", "fraction", "Sunlit, average"],
  ["earth_visible_fraction", "Earth: visible", "fraction", "Earth visible"],
] as const;

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
      surface_height_m: {
        value: 1942.16,
        unit: "m",
        baseline_m: null,
        reason: null,
        evidence: evidence("height"),
        limitations: [],
      },
      slope_at_site_deg: {
        value: 5.45,
        unit: "deg",
        baseline_m: 40,
        reason: null,
        evidence: evidence("slope"),
        limitations: ["synthetic limit"],
      },
      roughness_rms_m: {
        value: 0.448,
        unit: "m",
        baseline_m: 100,
        reason: null,
        evidence: evidence("roughness"),
        limitations: [],
      },
      sun_mean_visible_disk_fraction: {
        value: null,
        unit: "fraction",
        baseline_m: null,
        reason: "terrain illumination not available",
        evidence: null,
        limitations: [],
      },
      earth_visible_fraction: {
        value: 0.62,
        unit: "fraction",
        baseline_m: null,
        reason: null,
        evidence: evidence("earth"),
        limitations: [],
      },
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

async function serve(page: Page) {
  await page.route(COMPARE, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(syntheticComparison(route.request().url())),
    }),
  );
}

test("comparison table: demo trio by default, every cell opens its own evidence, nulls show the reason", async ({
  page,
  request,
}) => {
  const ids = await registerTrio(request);
  try {
    await serve(page);
    await page.goto("/compare");
    const table = page.getByTestId("compare-table");
    await expect(page.getByTestId("compare-row")).toHaveCount(3);
    for (const [, , , shown] of COLUMNS) await expect(table.locator("thead")).toContainText(shown);
    await expect(table.locator("thead")).toContainText("(°)");
    await expect(page.getByTestId("compare-window")).toContainText("1 Jan 2027 to 1 Jan 2028 (UTC)");

    const slope = table.getByTestId("cell-slope_at_site_deg").first();
    await expect(slope).toContainText("5.45°");
    await expect(slope).toContainText("@ 40 m");
    await slope.click();
    const panel = page.getByTestId("cell-evidence");
    await expect(panel.getByTestId("cell-evidence-meaning")).toContainText("How steep the ground is");
    await expect(panel).toContainText("SYNTHETIC E2E FIXTURE — slope");
    await expect(panel).toContainText(`SHA-256 ${SHA}`);
    await expect(panel).toContainText("synthetic limit");
    await expect(panel.getByRole("link", { name: /Synthetic DEM source/ })).toHaveAttribute(
      "href",
      "https://pgda.gsfc.nasa.gov/products/90",
    );
    await page.keyboard.press("Escape");

    const sun = table.getByTestId("cell-sun_mean_visible_disk_fraction").first();
    await expect(sun).toHaveAttribute("data-null", "true");
    await expect(sun).toContainText("terrain illumination not available");
    await expect(sun).not.toContainText("0");
    await sun.click();
    await expect(page.getByTestId("cell-evidence-reason")).toContainText(
      "terrain illumination not available",
    );
    await page.keyboard.press("Escape");

    await expect(table.getByTestId("cell-earth_visible_fraction").first()).toContainText("62.0 %");
  } finally {
    await cleanup(request, ids);
  }
});

test("selected-site card fills height/slope/bumpiness/average sunlight/Earth visible from the comparison row", async ({
  page,
  request,
}) => {
  const ids = await registerTrio(request);
  try {
    await serve(page);
    await page.goto("/");
    await page.getByTestId("site-list").locator("li").first().locator("button[aria-pressed]").click();
    await expect(page.getByTestId("selected-site-surface_height_m")).toContainText("1,942 m");
    await expect(page.getByTestId("selected-site-slope_at_site_deg")).toContainText("@ 40 m");
    await expect(page.getByTestId("selected-site-period")).toContainText("1 Jan 2027 to 1 Jan 2028 (UTC)");
    await expect(page.getByTestId("selected-site-sun_mean_visible_disk_fraction")).toContainText(
      "terrain illumination not available",
    );
    await page.getByTestId("selected-site-roughness_rms_m").click();
    await expect(page.getByTestId("cell-evidence")).toContainText("SYNTHETIC E2E FIXTURE — roughness");
  } finally {
    await cleanup(request, ids);
  }
});

test.describe("phone width", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("works at 390 px: the table scrolls inside its box, the page does not", async ({ page, request }) => {
    const ids = await registerTrio(request);
    try {
      await serve(page);
      await page.goto("/compare");
      await expect(page.getByTestId("compare-row")).toHaveCount(3);
      const [scrollWidth, innerWidth] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        innerWidth,
      ]);
      expect(scrollWidth).toBe(innerWidth);
      await page.getByTestId("cell-surface_height_m").first().click();
      await expect(page.getByTestId("cell-evidence")).toBeVisible();
    } finally {
      await cleanup(request, ids);
    }
  });
});

test("live API: every site ends as a finished row or shows its own error", async ({ page, request }) => {
  test.setTimeout(180_000);
  const ids = await registerTrio(request);
  try {
    await page.goto("/compare");
    // One request per site: each site ends as a row with numbers, or as a row with its error and Retry.
    const finished = page.getByTestId("compare-row").or(page.getByTestId("compare-row-error"));
    await expect(finished).toHaveCount(3, { timeout: 150_000 });
    // Null cells always show a reason.
    for (const cell of await page.locator('[data-null="true"]').all())
      await expect(cell).toContainText("N/C ·");
  } finally {
    await cleanup(request, ids);
  }
});
