import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * T-19: terrain page. The terrain endpoint is served by a SYNTHETIC response that stands in
 * for the mocked PGDA 20 m window (labelled in its evidence; not lunar results), for the real
 * registered demo trio.
 */

const API = "http://localhost:8100";
const TERRAIN = /\/api\/v1\/sites\/[^/]+\/terrain\?/;

function synthetic(url: string) {
  const u = new URL(url);
  const siteId = u.pathname.split("/")[4]!;
  const radius = Number(u.searchParams.get("footprint_radius_m"));
  const maxSlope = u.searchParams.get("max_slope_deg");
  const maxRough = u.searchParams.get("max_roughness_m");
  const hazard =
    maxSlope || maxRough
      ? {
          max_slope_deg: maxSlope ? Number(maxSlope) : null,
          max_roughness_m: maxRough ? Number(maxRough) : null,
          slope_fraction_above: maxSlope ? 0.25 : null,
          slope_p95_exceeds: maxSlope ? true : null,
          roughness_exceeds: maxRough ? false : null,
          evidence: {
            kind: "assumption",
            statement: "SYNTHETIC E2E FIXTURE — thresholds from the user",
            sources: [],
            method: null,
            assumptions: [maxSlope ? `max_slope_deg = ${maxSlope}` : `max_roughness_m = ${maxRough}`],
          },
        }
      : null;
  return {
    site_id: siteId,
    latitude_deg: -89.45,
    longitude_deg: 222.69,
    height_m: 1955.01,
    scale_factor: 1.000023,
    slope_at_site: { slope_deg: 5.3, baseline_m: 40 },
    footprint: {
      radius_m: radius,
      cell_count: 79,
      missing_cell_count: 2,
      height_min_m: 1950.4,
      height_max_m: 1957.5,
      height_mean_m: 1954.4,
      slope_mean_deg: 3.43,
      slope_p95_deg: 6.61,
      slope_max_deg: 8.42,
      slope_baseline_m: 40,
      roughness_rms_m: 1.35,
      roughness_baseline_m: 2 * radius,
    },
    hazard,
    dem: {
      dataset_id: "pgda-lola-20mpp-80s",
      title: "SYNTHETIC PGDA window",
      url: "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF",
      etag: 'W/"synthetic-etag"',
      last_modified: "Fri, 07 Jul 2023 22:28:19 GMT",
      resolution_m: 20,
      window_col_row_width_height: [14134, 15312, 18, 18],
      window_map_bounds_m: [0, 1, 0, 1],
      bytes_requested: 1234567,
      http_retries: 1,
      served_from_cache: false,
      read_at_utc: "2026-11-09T00:00:00+00:00",
      citation: "Synthetic citation.",
    },
    evidence: {
      kind: "calculation",
      statement: "SYNTHETIC E2E FIXTURE — terrain values",
      sources: [
        {
          source_id: "pgda-lola-20mpp-80s",
          title: "Synthetic DEM source",
          url: "https://pgda.gsfc.nasa.gov/products/90",
          version: 'ETag W/"synthetic-etag"',
          sha256: null,
          citation: "Synthetic citation.",
        },
      ],
      method: "Horn slope (synthetic)",
      assumptions: ["Footprint radius from the request."],
    },
    limitations: ["Synthetic limitation."],
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

async function serve(page: Page, status = 200) {
  await page.route(TERRAIN, (route) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(
        status === 200
          ? synthetic(route.request().url())
          : {
              error: {
                code: "out_of_coverage",
                message: "Site is outside the pgda-lola-20mpp-80s coverage (about 80°S–90°S).",
                details: [],
                request_id: null,
              },
            },
      ),
    }),
  );
}

test("terrain page: values with baselines, window provenance in the evidence, no hazard without thresholds", async ({
  page,
  request,
}) => {
  const ids = await registerTrio(request);
  try {
    await serve(page);
    await page.goto("/terrain");
    await expect(page.getByTestId("terrain-idle")).toBeVisible();
    await page.getByTestId("terrain-radius").fill("100");
    await page.getByTestId("terrain-submit").click();
    await expect(page.getByTestId("terrain-results")).toBeVisible();
    await expect(page.getByTestId("value-slope-site")).toContainText("5.30°");
    await expect(page.getByTestId("value-slope-site")).toContainText("@ 40 m");
    await expect(page.getByTestId("value-roughness")).toContainText("@ 200 m");
    await expect(page.getByTestId("value-missing")).toContainText("2");
    await expect(page.getByTestId("hazard-none")).toBeVisible();
    await expect(page.getByTestId("hazard-flags")).toHaveCount(0);
    await page.getByTestId("value-roughness").click();
    const popover = page.getByTestId("cell-evidence");
    await expect(popover).toBeVisible();
    await expect(popover).toContainText("1,234,567 bytes requested");
    await expect(popover).toContainText('ETag W/"synthetic-etag"');
    await expect(popover).toContainText("LDEM_80S_20MPP_ADJ.TIF");
  } finally {
    await cleanup(request, ids);
  }
});

test("hazard flags appear only for typed thresholds, labelled as user assumptions", async ({
  page,
  request,
}) => {
  const ids = await registerTrio(request);
  try {
    await serve(page);
    await page.goto("/terrain");
    await page.getByTestId("terrain-max-slope").fill("5");
    await page.getByTestId("terrain-submit").click();
    const flags = page.getByTestId("hazard-flags");
    await expect(flags).toBeVisible();
    await expect(flags).toContainText("User assumption");
    await expect(page.getByTestId("hazard-slope")).toContainText("exceeds");
    await expect(page.getByTestId("hazard-slope-fraction")).toContainText("25.0 %");
    await expect(page.getByTestId("hazard-roughness")).toHaveCount(0);
    await expect(flags).toContainText("max_slope_deg = 5");
  } finally {
    await cleanup(request, ids);
  }
});

test("invalid thresholds disable Analyse; outside coverage shows the reason", async ({ page, request }) => {
  const ids = await registerTrio(request);
  try {
    await serve(page, 422);
    await page.goto("/terrain");
    await page.getByTestId("terrain-max-slope").fill("95");
    await expect(page.getByTestId("terrain-submit")).toBeDisabled();
    await page.getByTestId("terrain-max-slope").fill("");
    await page.getByTestId("terrain-submit").click();
    await expect(page.getByTestId("terrain-error")).toContainText("Outside DEM coverage");
  } finally {
    await cleanup(request, ids);
  }
});

test.describe("phone width", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("works at 390 px: no horizontal scroll, evidence opens", async ({ page, request }) => {
    const ids = await registerTrio(request);
    try {
      await serve(page);
      await page.goto("/terrain");
      await page.getByTestId("terrain-submit").click();
      await expect(page.getByTestId("terrain-results")).toBeVisible();
      const [scrollWidth, innerWidth] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        innerWidth,
      ]);
      expect(scrollWidth).toBe(innerWidth);
      await page.getByTestId("value-slope-p95").click();
      await expect(page.getByTestId("cell-evidence")).toBeVisible();
    } finally {
      await cleanup(request, ids);
    }
  });
});
