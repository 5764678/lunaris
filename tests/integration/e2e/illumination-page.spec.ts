import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * T-27: the Illumination & Earth visibility page (/illumination).
 *
 * The horizon mask (T-16) and the timeline (T-24) are served SYNTHETIC by route
 * interception, labelled as such in their evidence: they test the page, not lunar
 * geometry, and keep the spec fast (no ray marching, no SPICE). The sites are the real
 * cited demo trio, registered through the API.
 */

const API = "http://localhost:8100";
const HORIZON = /\/api\/v1\/sites\/[^/]+\/horizon(\?|$)/;
const TIMELINE = /\/api\/v1\/analysis\/timeline$/;
const SYNTHETIC = "SYNTHETIC E2E FIXTURE — not lunar data.";

const evidence = {
  kind: "calculation",
  statement: SYNTHETIC,
  sources: [{ source_id: "synthetic", title: "Synthetic fixture", url: null, sha256: null }],
  method: "synthetic",
  assumptions: [],
};

function syntheticHorizon(siteId: string) {
  const n = 1440;
  const azimuth = Array.from({ length: n }, (_, i) => i * 0.25);
  return {
    site_id: siteId,
    latitude_deg: -89.5,
    longitude_deg: 0,
    frame: "MOON_ME",
    observer_height_m: 2,
    surface_height_m: 0,
    azimuth_step_deg: 0.25,
    azimuth_deg: azimuth,
    elevation_deg: azimuth.map((a) => 1 + Math.sin((a * Math.PI) / 90)),
    truncated: azimuth.map((a) => a >= 100 && a < 110),
    truncated_count: 40,
    max_range_m: 200_000,
    method: "synthetic",
    dem: {
      dataset_id: "synthetic",
      title: "synthetic",
      sha256: "0",
      resolution_m: 240,
      source_url: "",
      citation: "",
    },
    evidence,
    limitations: ["40 of 1440 azimuths left LDEM coverage before 200 km: their horizon is a lower bound."],
  };
}

function syntheticTimeline(body: { site_id: string; start_utc: string; end_utc: string; step_s: number }) {
  const start = Date.parse(body.start_utc);
  const end = Date.parse(body.end_utc);
  const step = body.step_s * 1000;
  const count = Math.floor((end - start) / step) + 1;
  const epochs = Array.from({ length: count }, (_, i) => new Date(start + i * step).toISOString());
  const window = (from: number, to: number, censoredStart: boolean, censoredEnd: boolean) => ({
    start_utc: new Date(start + from * step).toISOString(),
    end_utc: new Date(start + to * step).toISOString(),
    duration_s: (to - from) * body.step_s,
    censored_start: censoredStart,
    censored_end: censoredEnd,
  });
  const sunSummary = (horizon: string) => ({
    horizon,
    mean_visible_disk_fraction: 0.42,
    illuminated_fraction: 0.5,
    fully_lit_fraction: 0.4,
    longest_illumination_s: 10 * body.step_s,
    longest_illumination_censored: true,
    longest_darkness_s: 5 * body.step_s,
    longest_darkness_censored: false,
    resolution_s: body.step_s,
    any_truncated: false,
    sunlit_windows: [window(0, 10, true, false), window(20, 25, false, false)],
  });
  const earthSummary = (horizon: string) => ({
    horizon,
    visible_fraction: 0.6,
    mean_visible_disk_fraction: 0.55,
    fully_visible_fraction: 0.5,
    longest_visibility_s: 8 * body.step_s,
    longest_visibility_censored: false,
    longest_outage_s: 4 * body.step_s,
    longest_outage_censored: false,
    resolution_s: body.step_s,
    any_truncated: false,
    windows: [window(2, 10, false, false)],
  });
  return {
    site_id: body.site_id,
    site_name: "synthetic",
    observer: {},
    start_utc: body.start_utc,
    end_utc: body.end_utc,
    step_s: body.step_s,
    sample_count: count,
    max_samples: 10_000,
    terrain_horizon_available: true,
    illumination: {
      body: "sun",
      samples: epochs.map((epoch_utc, i) => ({
        epoch_utc,
        azimuth_deg: (i * 13) % 360,
        elevation_deg: 1.5 * Math.sin(i / 20),
        solar_radius_deg: 0.27,
        astronomical_visible_fraction: 1,
        terrain_horizon_elevation_deg: 1,
        terrain_visible_fraction: 0.5,
        terrain_truncated: false,
      })),
      astronomical: sunSummary("astronomical"),
      terrain: sunSummary("terrain"),
      evidence,
      limitations: ["Synthetic limitation."],
    },
    earth_visibility: {
      body: "earth",
      samples: epochs.map((epoch_utc, i) => ({
        epoch_utc,
        azimuth_deg: 355 + (i % 10),
        elevation_deg: 3 * Math.sin(i / 50),
        earth_radius_deg: 0.95,
        astronomical_visible_fraction: 1,
        terrain_horizon_elevation_deg: 1,
        terrain_visible_fraction: 1,
        terrain_truncated: false,
        line_of_sight: "clear",
      })),
      astronomical: earthSummary("astronomical"),
      terrain: earthSummary("terrain"),
      evidence,
      limitations: [
        "Geometric line of sight only: Earth visibility does not imply a radio link (synthetic copy).",
      ],
    },
    computed_at_utc: body.start_utc,
    software: { service_version: "synthetic", components: [] },
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

async function serve(page: Page, { horizonDown = false } = {}) {
  await page.route(HORIZON, (route) => {
    const siteId = new URL(route.request().url()).pathname.split("/").at(-2)!;
    return horizonDown
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "dataset_unavailable",
              message: "LDEM not acquired (synthetic 503).",
              details: [],
            },
          }),
        })
      : route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(syntheticHorizon(siteId)),
        });
  });
  await page.route(TIMELINE, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(syntheticTimeline(route.request().postDataJSON())),
    }),
  );
}

test("illumination page: demo trio tabs, sky chart with lower bounds, censored windows, evidence, radio-link disclaimer", async ({
  page,
  request,
}) => {
  const ids = await registerTrio(request);
  try {
    await serve(page);
    await page.goto("/illumination");

    const tabs = page.getByTestId("illumination-site-tabs").getByRole("tab");
    await expect(page.locator('[role=tab][data-demo="true"]')).toHaveCount(3);
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await expect(tabs.first()).toHaveAttribute("data-demo", "true");

    const chart = page.getByTestId("sky-chart");
    await expect(chart).toHaveAttribute("data-plot-state", "ready");
    await expect(chart).toHaveAttribute("data-lower-bound-count", "40");
    await expect(chart).toHaveAttribute("data-track-count", "2");

    // Censored run: flagged as a lower bound, with the reason in its evidence.
    const longest = page.getByTestId("sun-summary-longest_illumination_s-terrain");
    await expect(page.locator('[data-lower-bound="true"]').filter({ has: longest })).toHaveCount(1);
    await longest.click();
    const popover = page.getByTestId("cell-evidence");
    await expect(popover).toContainText(SYNTHETIC);
    await expect(popover).toContainText("lower bound");
    await page.keyboard.press("Escape");

    await expect(page.locator('[data-testid="sun-windows-row"][data-censored="true"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="sun-windows-row"][data-censored="false"]')).toHaveCount(1);

    await page.getByTestId("horizon-max").click();
    await expect(page.getByTestId("cell-evidence")).toContainText("lower bound");
    await page.keyboard.press("Escape");

    await expect(page.getByTestId("radio-link-disclaimer")).toContainText("does not imply a radio link");

    // Another tab loads that site.
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("site-illumination")).toHaveAttribute("data-site-id", ids[1]!);
  } finally {
    await cleanup(request, ids);
  }
});

test("without a terrain horizon the page shows the reason, never 0", async ({ page, request }) => {
  const ids = await registerTrio(request);
  try {
    await serve(page, { horizonDown: true });
    await page.goto("/illumination");
    await expect(page.getByTestId("horizon-unavailable")).toContainText("LDEM not acquired");
    await expect(page.getByTestId("sky-chart")).toHaveAttribute("data-lower-bound-count", "0");
  } finally {
    await cleanup(request, ids);
  }
});

test.describe("phone width", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("works at 390 px: no horizontal page scroll, evidence opens", async ({ page, request }) => {
    const ids = await registerTrio(request);
    try {
      await serve(page);
      await page.goto("/illumination");
      await expect(page.getByTestId("sky-chart")).toHaveAttribute("data-plot-state", "ready");
      await expect(page.getByTestId("earth-summary")).toBeVisible();
      const [scrollWidth, innerWidth] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        window.innerWidth,
      ]);
      expect(scrollWidth).toBe(innerWidth);
      await page.getByTestId("earth-summary-visible_fraction-terrain").click();
      await expect(page.getByTestId("cell-evidence")).toBeVisible();
    } finally {
      await cleanup(request, ids);
    }
  });
});
