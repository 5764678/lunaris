import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * T-32: Plotly Sun/Earth elevation lanes from C2 (`GET /api/v1/sites/{id}/ephemeris`).
 *
 * The deterministic tests serve a SYNTHETIC ephemeris by route interception (labelled in
 * its evidence; not lunar geometry). The live test runs against the real API: with the
 * NAIF kernels acquired the lanes plot SPICE output; without them (CI) the lanes must
 * stay "not computed" with the API's reason.
 */

const API = "http://localhost:8100";
const EPHEMERIS = /\/api\/v1\/sites\/[^/]+\/ephemeris\?/;

function syntheticEphemeris(url: string) {
  const query = new URL(url).searchParams;
  const start = Date.parse(query.get("start_utc")!);
  const end = Date.parse(query.get("end_utc")!);
  const step = Number(query.get("step_s")) * 1000;
  const body = (name: "sun" | "earth", amplitude: number, offset: number, radius: number) => ({
    body: name,
    body_radius_m: 1,
    body_radii_m: [1, 1, 1],
    evidence: {
      kind: "model",
      statement: "SYNTHETIC E2E FIXTURE — not lunar geometry.",
      sources: [],
      method: "synthetic",
      assumptions: [],
    },
    samples: Array.from({ length: Math.floor((end - start) / step) + 1 }, (_, i) => ({
      epoch_utc: new Date(start + i * step).toISOString(),
      azimuth_deg: 0,
      elevation_deg: offset + amplitude * Math.sin((2 * Math.PI * i * step) / (27.3 * 86_400_000)),
      range_m: 1,
      angular_radius_deg: radius,
      direction_moon_me: [1, 0, 0],
    })),
  });
  return {
    site_id: "synthetic",
    site_name: "synthetic",
    frame: "MOON_ME",
    aberration_correction: "CN+S",
    start_utc: query.get("start_utc"),
    end_utc: query.get("end_utc"),
    step_s: Number(query.get("step_s")),
    sample_count: 0,
    max_samples: 10_000,
    observer: {},
    limitations: [],
    bodies: [body("sun", 0.5, 1.5, 0.27), body("earth", 6, 0, 0.95)],
  };
}

async function createSite(request: APIRequestContext, name: string) {
  const response = await request.post(`${API}/api/v1/sites`, {
    data: { name, latitude_deg: -89.5, longitude_deg: 0, notes: "e2e timeline lanes" },
  });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { id: string }).id;
}

async function selectSite(page: Page, name: string) {
  await page
    .getByTestId("site-list")
    .locator("li", { hasText: name })
    .locator("button[aria-pressed]")
    .click();
  await expect(page.getByTestId("selected-site-name")).toHaveText(name);
}

test.describe("timeline lanes", () => {
  let siteId = "";
  const name = `E2E lanes ${Date.now()}`;

  test.beforeAll(async ({ request }) => {
    siteId = await createSite(request, name);
  });
  test.afterAll(async ({ request }) => {
    await request.delete(`${API}/api/v1/sites/${siteId}`);
  });

  test("without a selected site the lanes stay not computed", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('[data-lane="sun"]')).toHaveAttribute("data-lane-state", "not-computed");
    await expect(page.locator('[data-lane="sun"]')).toContainText("Not computed · select a site");
  });

  test("plots computed Sun and Earth lanes with evidence; other lanes stay not computed", async ({
    page,
  }) => {
    await page.route(EPHEMERIS, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(syntheticEphemeris(route.request().url())),
      }),
    );
    await page.goto("/");
    await selectSite(page, name);

    for (const lane of ["sun", "earth"]) {
      const el = page.locator(`[data-lane="${lane}"]`);
      await expect(el).toHaveAttribute("data-lane-state", "computed");
      await expect(el.locator('[data-plot-state="ready"]')).toBeVisible();
      await expect(el.locator(".main-svg").first()).toBeVisible(); // Plotly rendered
      await expect(page.getByTestId(`lane-readout-${lane}`)).toHaveText(/^[+−]\d+\.\d{2}°$/);
    }
    await expect(page.locator('[data-evidence="model"]').first()).toBeVisible();
    for (const lane of ["illumination", "los"]) {
      await expect(page.locator(`[data-lane="${lane}"]`)).toHaveAttribute("data-lane-state", "not-computed");
    }

    // The readout follows the epoch cursor (keyboard: +1 day).
    const before = await page.getByTestId("lane-readout-earth").textContent();
    await page.getByTestId("timeline-track").focus();
    for (let i = 0; i < 5; i++) await page.keyboard.press("PageUp");
    await expect(page.getByTestId("lane-readout-earth")).not.toHaveText(before!);
  });

  test("an API error leaves the lanes not computed with the reason, never a plot", async ({ page }) => {
    await page.route(EPHEMERIS, (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "kernels_unavailable",
            message: "SPICE kernels not acquired.",
            details: [],
            request_id: "e2e",
          },
        }),
      }),
    );
    await page.goto("/");
    await selectSite(page, name);
    const sun = page.locator('[data-lane="sun"]');
    await expect(sun).toContainText("SPICE kernels not acquired", { timeout: 30_000 });
    await expect(sun).toHaveAttribute("data-lane-state", "not-computed");
    await expect(page.getByTestId("lane-readout-sun")).toHaveCount(0);
  });

  test("live API: SPICE lanes when kernels are acquired, otherwise a labelled reason", async ({ page }) => {
    await page.goto("/");
    await selectSite(page, name);
    const sun = page.locator('[data-lane="sun"]');
    await expect(sun.locator('[data-plot-state="ready"]').or(sun.getByText(/Not computed · /))).toBeVisible({
      timeout: 60_000,
    });
    if ((await sun.getAttribute("data-lane-state")) === "computed") {
      await expect(page.getByTestId("lane-readout-sun")).toHaveText(/^[+−]\d+\.\d{2}°$/);
    } else {
      await expect(sun).not.toContainText("select a site");
    }
  });
});

test("readiness lists only modules with served, displayed output as available", async ({ page }) => {
  await page.goto("/");
  for (const id of ["terrain", "geometry", "illumination", "visibility", "analysis"]) {
    await expect(page.getByTestId(`readiness-${id}`)).toHaveText(/available/i);
  }
});

/** SYNTHETIC C4 timeline (labelled). `terrain` null = no horizon mask served. */
function syntheticTimeline(
  body: { site_id: string; start_utc: string; end_utc: string; step_s: number },
  terrain: number | null,
) {
  const start = Date.parse(body.start_utc);
  const step = body.step_s * 1000;
  const n = Math.floor((Date.parse(body.end_utc) - start) / step) + 1;
  const ev = {
    kind: "calculation",
    statement: "SYNTHETIC E2E FIXTURE.",
    sources: [],
    method: "x",
    assumptions: [],
  };
  const samples = Array.from({ length: n }, (_, i) => ({
    epoch_utc: new Date(start + i * step).toISOString(),
    azimuth_deg: 0,
    elevation_deg: 1,
    astronomical_visible_fraction: 1,
    terrain_visible_fraction: terrain,
    terrain_truncated: terrain === null ? null : true,
    line_of_sight: "clear",
  }));
  return {
    site_id: body.site_id,
    step_s: body.step_s,
    terrain_horizon_available: terrain !== null,
    illumination: { evidence: ev, limitations: [], astronomical: {}, terrain: null, samples },
    earth_visibility: { evidence: ev, limitations: [], astronomical: {}, terrain: null, samples },
  };
}

for (const terrain of [null, 0.42]) {
  test(`illumination and line-of-sight lanes (${terrain === null ? "no terrain horizon" : "terrain served"})`, async ({
    page,
    request,
  }) => {
    const name = `E2E fractions ${terrain} ${Date.now()}`;
    const id = await createSite(request, name);
    try {
      await page.route(/\/api\/v1\/analysis\/timeline$/, (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(syntheticTimeline(route.request().postDataJSON(), terrain)),
        }),
      );
      await page.goto("/");
      await selectSite(page, name);
      for (const lane of ["illumination", "los"]) {
        const el = page.locator(`[data-lane="${lane}"]`);
        await expect(el).toHaveAttribute("data-lane-state", "computed");
        await expect(el.locator('[data-plot-state="ready"]')).toBeVisible();
        const readout = page.getByTestId(`lane-readout-${lane}`);
        if (terrain === null) {
          await expect(page.getByTestId(`lane-note-${lane}`)).toContainText("Terrain horizon not available");
          await expect(readout).toHaveText("100 % with no hills · terrain map not available");
        } else {
          await expect(page.getByTestId(`lane-note-${lane}`)).toHaveCount(0);
          await expect(readout).toHaveText("≤ 42 % (100 % with no hills)");
        }
      }
      await expect(page.getByTestId("lane-los-state")).toHaveText("In view");
    } finally {
      await request.delete(`${API}/api/v1/sites/${id}`);
    }
  });
}
