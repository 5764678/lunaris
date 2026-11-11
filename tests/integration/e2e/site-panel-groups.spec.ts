import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";

/**
 * C1: the selected-site card keeps values that cover different stretches of time apart, in three
 * labelled groups: the selected moment ("At the selected time"), the ground ("Ground at the
 * site", no time at all) and the average over the comparison dates ("Over 2027"). The
 * selected-moment values come from the same timeline analysis the lanes plot, so card and lane
 * cannot disagree.
 *
 * Responses are SYNTHETIC (labelled in every evidence statement; not lunar results), served by
 * route interception for the real registered demo trio.
 */

const API = "http://localhost:8100";
const COMPARE = /\/api\/v1\/analysis\/site-comparison\?/;
const TIMELINE = /\/api\/v1\/analysis\/timeline$/;
const EPHEMERIS = /\/api\/v1\/sites\/[^/]+\/ephemeris\?/;

const YEAR_2027: [string, string] = ["2027-01-01T00:00:00Z", "2028-01-01T00:00:00Z"];

const evidence = (statement: string) => ({
  kind: "calculation",
  statement: `SYNTHETIC E2E FIXTURE — ${statement}`,
  sources: [],
  method: "synthetic method",
  assumptions: [],
});

const cell = (value: number, unit: string, what: string) => ({
  value,
  unit,
  baseline_m: null,
  reason: null,
  evidence: evidence(what),
  limitations: [],
});

/** A value the API could not compute: no number, no evidence, only the reason. */
const missing = (unit: string, reason: string) => ({
  value: null,
  unit,
  baseline_m: null,
  reason,
  evidence: null,
  limitations: [],
});

/**
 * The reason the hosted demo gave when NASA's server refused its request: a web address with no
 * spaces in it, longer than the whole value column of the card.
 */
const REFUSED_BY_NASA =
  "terrain analysis not available: Could not read pgda-lola-20mpp-80s: HEAD " +
  "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF failed: 403 Forbidden";

function syntheticComparison(url: string, [start, end]: [string, string], missingReason?: string) {
  const ids = new URL(url).searchParams.get("site_ids")!.split(",");
  const metric = (value: number, unit: string, what: string) =>
    missingReason === undefined ? cell(value, unit, what) : missing(unit, missingReason);
  return {
    start_utc: start,
    end_utc: end,
    step_s: 3600,
    sample_count: 8761,
    observer_height_m: 2,
    footprint_radius_m: 50,
    assumptions: [],
    columns: [
      ["surface_height_m", "Height", "m"],
      ["slope_at_site_deg", "Slope at site", "deg"],
      ["roughness_rms_m", "Roughness", "m"],
      ["sun_mean_visible_disk_fraction", "Sun: mean visible disk", "fraction"],
      ["earth_visible_fraction", "Earth: visible", "fraction"],
    ].map(([key, label, unit]) => ({ key, label, unit, description: label })),
    rows: ids.map((id, i) => ({
      site_id: id,
      name: `row-${i}`,
      origin: "published",
      latitude_deg: -89,
      longitude_deg: 10 * i,
      surface_height_m: metric(1942.16, "m", "height"),
      slope_at_site_deg: metric(5.45, "deg", "slope"),
      roughness_rms_m: metric(0.448, "m", "roughness"),
      sun_mean_visible_disk_fraction: metric(0.685, "fraction", "sun average"),
      earth_visible_fraction: metric(0.542, "fraction", "earth average"),
    })),
  };
}

/**
 * The terrain-aware sunlit share changes by 7 points per UTC day (modulo 100), so moving the
 * cursor by days always changes the number; `null` serves no terrain horizon.
 */
function syntheticTimeline(
  body: { site_id: string; start_utc: string; end_utc: string; step_s: number },
  terrain: "varying" | null,
) {
  const start = Date.parse(body.start_utc);
  const step = body.step_s * 1000;
  const n = Math.floor((Date.parse(body.end_utc) - start) / step) + 1;
  const ev = evidence("timeline");
  const samples = Array.from({ length: n }, (_, i) => {
    const epoch = start + i * step;
    return {
      epoch_utc: new Date(epoch).toISOString(),
      azimuth_deg: 0,
      elevation_deg: 1,
      astronomical_visible_fraction: 1,
      terrain_visible_fraction: terrain === null ? null : ((Math.floor(epoch / 86_400_000) * 7) % 100) / 100,
      terrain_truncated: terrain === null ? null : true,
      line_of_sight: "clear",
    };
  });
  return {
    site_id: body.site_id,
    step_s: body.step_s,
    terrain_horizon_available: terrain !== null,
    illumination: { evidence: ev, limitations: [], astronomical: {}, terrain: null, samples },
    earth_visibility: { evidence: ev, limitations: [], astronomical: {}, terrain: null, samples },
  };
}

function syntheticEphemeris(url: string) {
  const query = new URL(url).searchParams;
  const start = Date.parse(query.get("start_utc")!);
  const end = Date.parse(query.get("end_utc")!);
  const step = Number(query.get("step_s")) * 1000;
  const body = (name: "sun" | "earth", offset: number, radius: number) => ({
    body: name,
    body_radius_m: 1,
    body_radii_m: [1, 1, 1],
    evidence: { ...evidence("not lunar geometry"), kind: "model" },
    samples: Array.from({ length: Math.floor((end - start) / step) + 1 }, (_, i) => ({
      epoch_utc: new Date(start + i * step).toISOString(),
      azimuth_deg: 0,
      elevation_deg: offset,
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
    bodies: [body("sun", 1.5, 0.27), body("earth", 3, 0.95)],
  };
}

const unavailable = {
  status: 503,
  contentType: "application/json",
  body: JSON.stringify({
    error: { code: "unavailable", message: "E2E analysis unavailable.", details: [], request_id: "e2e" },
  }),
};

async function registerTrio(request: APIRequestContext) {
  const response = await request.post(`${API}/api/v1/catalog/demo-trio/register`);
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { sites: { id: string }[] }).sites.map((s) => s.id);
}

async function cleanup(request: APIRequestContext, ids: string[]) {
  for (const id of ids) await request.delete(`${API}/api/v1/sites/${id}`);
}

type Setup = {
  window?: [string, string];
  terrain?: "varying" | null;
  timelineFails?: boolean;
  /** Serve every comparison value as "not computed" with this reason. */
  notComputedReason?: string;
};

/** Serves the synthetic responses, opens the dashboard and selects the first listed site. */
async function openCard(
  page: Page,
  { window = YEAR_2027, terrain = "varying", timelineFails, notComputedReason }: Setup = {},
) {
  await page.route(COMPARE, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(syntheticComparison(route.request().url(), window, notComputedReason)),
    }),
  );
  await page.route(TIMELINE, (route) =>
    timelineFails
      ? route.fulfill(unavailable)
      : route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(syntheticTimeline(route.request().postDataJSON(), terrain)),
        }),
  );
  await page.route(EPHEMERIS, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(syntheticEphemeris(route.request().url())),
    }),
  );
  await page.goto("/");
  await page.getByTestId("site-list").locator("li").first().locator("button[aria-pressed]").click();
  await expect(page.getByTestId("selected-site-name")).toBeVisible();
}

const groups = (page: Page) => ({
  now: page.getByRole("group", { name: "At the selected time" }),
  ground: page.getByRole("group", { name: "Ground at the site" }),
  average: page.getByRole("group", { name: /^Over / }),
});

/**
 * Fails when any line of the text in `element` lies outside the cell it is in: the value column (`dd`)
 * of a card row, or a table cell. Text that overflows is drawn over the row's label or the next column,
 * or runs past the edge of the panel and is cut off.
 */
async function expectTextInsideCell(element: Locator, what: string) {
  const bounds = await element.evaluate((node) => {
    const cell = node.closest("dd, td, section")!.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(node);
    const lines = [...range.getClientRects()].filter((rect) => rect.width > 0);
    return {
      cellLeft: cell.left,
      cellRight: cell.right,
      textLeft: Math.min(...lines.map((rect) => rect.left)),
      textRight: Math.max(...lines.map((rect) => rect.right)),
    };
  });
  expect(bounds.textLeft, `${what} runs past the left edge of its cell`).toBeGreaterThanOrEqual(
    bounds.cellLeft - 1,
  );
  expect(bounds.textRight, `${what} runs past the right edge of its cell`).toBeLessThanOrEqual(
    bounds.cellRight + 1,
  );
}

/** Every comparison value the card shows, as the group it sits in and its column key. */
const COMPARISON_ROWS = [
  ["ground", "surface_height_m"],
  ["ground", "slope_at_site_deg"],
  ["ground", "roughness_rms_m"],
  ["average", "sun_mean_visible_disk_fraction"],
  ["average", "earth_visible_fraction"],
] as const;

/** A refusal from NASA's server names a web address that cannot be broken at a space. */
async function expectLongReasonsInsideRows(page: Page) {
  await openCard(page, { notComputedReason: REFUSED_BY_NASA });
  const panel = groups(page);
  for (const [group, key] of COMPARISON_ROWS) {
    const reason = panel[group].getByTestId(`selected-site-${key}`).getByText(/^N\/C/);
    await expect(reason).toContainText("403 Forbidden");
    await expectTextInsideCell(reason, `The reason for ${key}`);
  }
}

test.describe("selected-site card groups", () => {
  let ids: string[] = [];
  test.beforeEach(async ({ request }) => {
    ids = await registerTrio(request);
  });
  test.afterEach(async ({ request }) => {
    await cleanup(request, ids);
  });

  test("three labelled groups: the selected moment, the ground, and the yearly average", async ({ page }) => {
    await openCard(page);
    const { now, ground, average } = groups(page);

    // The selected moment: Sun and Earth direction, sunlit share, Earth visible. Says which moment.
    await expect(now).toBeVisible();
    await expect(now.getByTestId("selected-site-time")).toContainText(/\d{4}.*UTC/);
    await expect(now.getByTestId("selected-site-sun-azel")).toBeVisible();
    await expect(now.getByTestId("selected-site-earth-azel")).toBeVisible();
    await expect(now.getByTestId("selected-site-now-sunlit")).toHaveText(/^≤ \d+ % \(100 % with no hills\)$/);
    await expect(now.getByTestId("selected-site-now-earth")).toHaveText(
      "In view line of sight only, not a radio link",
    );

    // The ground: no time at all, so no averages and no moment values in it.
    await expect(ground).toContainText("Does not change with time.");
    for (const name of ["Height", "Slope at site", "Bumpiness"])
      await expect(ground.getByText(name, { exact: true })).toBeVisible();
    await expect(ground.getByTestId("selected-site-surface_height_m")).toContainText("1,942 m");
    await expect(ground.getByTestId("selected-site-roughness_rms_m")).toContainText("0.45 m");

    // The average: named for the year, with the dates it covers.
    await expect(average).toHaveAccessibleName("Over 2027");
    await expect(average.getByTestId("selected-site-period")).toContainText(
      "Average · 1 Jan 2027 to 1 Jan 2028 (UTC)",
    );
    await expect(average.getByText("Sunlit, 2027 average", { exact: true })).toBeVisible();
    await expect(average.getByText("Earth visible, 2027 average", { exact: true })).toBeVisible();
    await expect(average.getByTestId("selected-site-sun_mean_visible_disk_fraction")).toContainText("68.5 %");
    await expect(average.getByTestId("selected-site-earth_visible_fraction")).toContainText("54.2 %");

    // Nothing sits in the wrong group.
    for (const testId of [
      "selected-site-sun_mean_visible_disk_fraction",
      "selected-site-earth_visible_fraction",
      "selected-site-surface_height_m",
    ])
      await expect(now.getByTestId(testId)).toHaveCount(0);
    for (const testId of ["selected-site-now-sunlit", "selected-site-now-earth", "selected-site-sun-azel"]) {
      await expect(ground.getByTestId(testId)).toHaveCount(0);
      await expect(average.getByTestId(testId)).toHaveCount(0);
    }
    await expect(average.getByTestId("selected-site-slope_at_site_deg")).toHaveCount(0);
  });

  test("the selected-time sunlit share is the lane's number, and follows the cursor", async ({ page }) => {
    await openCard(page);
    const card = page.getByTestId("selected-site-now-sunlit");
    const lane = page.getByTestId("lane-readout-illumination");
    const time = page.getByTestId("selected-site-time");
    await expect(lane).toHaveText(/^≤ \d+ %/);

    const before = {
      card: await card.textContent(),
      lane: await lane.textContent(),
      time: await time.textContent(),
    };
    expect(before.card).toBe(before.lane);

    await page.getByTestId("timeline-track").focus();
    for (let i = 0; i < 5; i++) await page.keyboard.press("PageUp");
    await expect(time).not.toHaveText(before.time!);
    const after = { card: await card.textContent(), lane: await lane.textContent() };
    expect(after.card).toBe(after.lane);
    expect(after.card).not.toBe(before.card);
  });

  test("without a terrain horizon the card says so, exactly as the lane does", async ({ page }) => {
    await openCard(page, { terrain: null });
    await expect(page.getByTestId("selected-site-now-sunlit")).toHaveText(
      "100 % with no hills · terrain map not available",
    );
    await expect(page.getByTestId("lane-readout-illumination")).toHaveText(
      "100 % with no hills · terrain map not available",
    );
  });

  test("dates that are not one calendar year are named as dates, never as a year", async ({ page }) => {
    await openCard(page, { window: ["2027-03-01T00:00:00Z", "2027-04-01T00:00:00Z"] });
    const { average } = groups(page);
    await expect(average).toHaveAccessibleName("Over the comparison dates");
    await expect(average.getByTestId("selected-site-period")).toContainText(
      "Average · 1 Mar 2027 to 1 Apr 2027 (UTC)",
    );
    await expect(average.getByText("Sunlit, average", { exact: true })).toBeVisible();
    await expect(average.getByText("Earth visible, average", { exact: true })).toBeVisible();
    await expect(page.getByText("2027 average")).toHaveCount(0);
  });

  test("when the timeline cannot be computed the selected-time rows say so with the reason, never a number", async ({
    page,
  }) => {
    await openCard(page, { timelineFails: true });
    const { now, average } = groups(page);
    const sunlitRow = now.getByText("Sunlit", { exact: true }).locator("..");
    const badge = sunlitRow.locator('[data-evidence="not_computed"]');
    await expect(badge).toBeVisible({ timeout: 30_000 });
    await expect(now.getByTestId("selected-site-now-sunlit")).toHaveCount(0);
    await expect(now.getByTestId("selected-site-now-earth")).toHaveCount(0);
    await badge.hover();
    await expect(page.getByRole("tooltip")).toContainText("E2E analysis unavailable.");
    // The rest of the card is unaffected: the averages still show their numbers.
    await expect(average.getByTestId("selected-site-sun_mean_visible_disk_fraction")).toContainText("68.5 %");
  });

  test("a long web address in a 'not computed' reason wraps inside its row", async ({ page }) => {
    await expectLongReasonsInsideRows(page);
  });

  test("the Source row of a catalogue site stays inside its row", async ({ page }) => {
    await openCard(page);
    await expectTextInsideCell(page.getByTestId("selected-site-source"), "The Source row");
  });

  test("the Compare table, which shows the same 'not computed' text, wraps it inside each cell", async ({
    page,
  }) => {
    await page.route(COMPARE, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(syntheticComparison(route.request().url(), YEAR_2027, REFUSED_BY_NASA)),
      }),
    );
    await page.goto("/compare");
    for (const [, key] of COMPARISON_ROWS) {
      const reason = page.getByTestId(`cell-${key}`).first().getByText(/^N\/C/);
      await expect(reason).toContainText("403 Forbidden");
      await expectTextInsideCell(reason, `The reason for ${key}`);
    }
  });
});

test.describe("phone width", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the selected-time values wrap rather than being cut off", async ({ page, request }) => {
    const ids = await registerTrio(request);
    try {
      await openCard(page);
      await expect(page.getByTestId("selected-site-now-sunlit")).toHaveText(
        /^≤ \d+ % \(100 % with no hills\)$/,
      );
      for (const testId of ["selected-site-now-sunlit", "selected-site-now-earth"]) {
        const clipped = await page
          .getByTestId(testId)
          .evaluate((element) => element.scrollWidth > element.clientWidth + 1);
        expect(clipped, `${testId} is cut off`).toBe(false);
      }
    } finally {
      await cleanup(request, ids);
    }
  });

  test("a long web address in a 'not computed' reason wraps inside its row", async ({ page, request }) => {
    const ids = await registerTrio(request);
    try {
      await expectLongReasonsInsideRows(page);
    } finally {
      await cleanup(request, ids);
    }
  });

  test("the Source row of a catalogue site stays inside its row", async ({ page, request }) => {
    const ids = await registerTrio(request);
    try {
      await openCard(page);
      await expectTextInsideCell(page.getByTestId("selected-site-source"), "The Source row");
    } finally {
      await cleanup(request, ids);
    }
  });
});
