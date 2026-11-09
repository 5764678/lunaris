import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * While the comparison is computed the Compare page must show what is happening: a table with one
 * row of spinners per site, a "Computing 2 of 3" line with a time estimate, rows that fill in as
 * each site is ready, and an error with a Retry button for a site that fails or times out. The
 * server answers with a SYNTHETIC comparison for the real registered demo trio (invented values,
 * not lunar results), one request per site, and the tests decide when each answer arrives.
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

function syntheticComparison(siteId: string) {
  return {
    start_utc: "2027-01-01T00:00:00Z",
    end_utc: "2028-01-01T00:00:00Z",
    step_s: 3600,
    sample_count: 8761,
    observer_height_m: 2,
    footprint_radius_m: 50,
    assumptions: [],
    columns: COLUMNS.map(([key, label, unit]) => ({ key, label, unit, description: label })),
    rows: [
      {
        site_id: siteId,
        name: `row-${siteId.slice(0, 6)}`,
        origin: "published",
        latitude_deg: -89,
        longitude_deg: 10,
        ...Object.fromEntries(
          COLUMNS.map(([key, , unit]) => [
            key,
            { value: 1.5, unit, baseline_m: null, reason: null, evidence: evidence(key), limitations: [] },
          ]),
        ),
      },
    ],
  };
}

const siteIdOf = (url: string) => new URL(url).searchParams.get("site_ids")!;

async function registerTrio(request: APIRequestContext) {
  const response = await request.post(`${API}/api/v1/catalog/demo-trio/register`);
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { sites: { id: string }[] }).sites.map((s) => s.id);
}

async function cleanup(request: APIRequestContext, ids: string[]) {
  for (const id of ids) await request.delete(`${API}/api/v1/sites/${id}`);
}

const ok = (id: string) => ({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify(syntheticComparison(id)),
});

const serverError = {
  status: 500,
  contentType: "application/json",
  body: JSON.stringify({ error: { code: "internal_error", message: "Synthetic failure for the e2e test." } }),
};

const headerCells = (page: Page) => page.locator('[data-testid="compare-table"] thead th');

test("rows of spinners appear at once and fill in site by site, with a progress line", async ({
  page,
  request,
}) => {
  const ids = await registerTrio(request);
  const requested: string[] = [];
  const gates = new Map<string, () => void>();
  try {
    await page.route(COMPARE, async (route) => {
      const id = siteIdOf(route.request().url());
      requested.push(id);
      await new Promise<void>((release) => gates.set(id, release));
      await route.fulfill(ok(id));
    });
    await page.goto("/compare");

    // Nothing has been answered yet, and the page already shows what is coming.
    await expect(page.getByTestId("compare-row-pending")).toHaveCount(3);
    await expect(page.getByTestId("compare-row")).toHaveCount(0);
    await expect(headerCells(page)).toHaveCount(13); // the site column and 12 metrics
    await expect(page.getByTestId("cell-pending")).toHaveCount(3 * 12);
    const progress = page.getByTestId("compare-progress");
    await expect(progress).toContainText("Computing 0 of 3 sites");
    await expect(progress).toContainText("20 to 40 seconds");
    await expect(page.getByTestId("compare-window")).toHaveCount(0);

    // One request per site.
    await expect.poll(() => requested.length).toBe(3);
    expect(new Set(requested)).toEqual(new Set(ids));

    // The first answer fills one row; the other two keep their spinners.
    gates.get(requested[0]!)!();
    await expect(page.getByTestId("compare-row")).toHaveCount(1);
    await expect(page.getByTestId("compare-row-pending")).toHaveCount(2);
    await expect(progress).toContainText("Computing 1 of 3 sites");
    await expect(page.getByTestId("compare-window")).toContainText("1 Jan 2027 to 1 Jan 2028 (UTC)");

    // The rest arrive: no spinners and no progress line are left.
    gates.get(requested[1]!)!();
    gates.get(requested[2]!)!();
    await expect(page.getByTestId("compare-row")).toHaveCount(3);
    await expect(page.getByTestId("compare-row-pending")).toHaveCount(0);
    await expect(page.getByTestId("cell-pending")).toHaveCount(0);
    await expect(progress).toHaveCount(0);
    await expect(page.getByTestId("cell-surface_height_m")).toHaveCount(3);
  } finally {
    for (const release of gates.values()) release();
    await cleanup(request, ids);
  }
});

test("a site that fails shows its own error and Retry; the other rows are unaffected", async ({
  page,
  request,
}) => {
  const ids = await registerTrio(request);
  let failingId: string | null = null;
  let healed = false;
  const attempts: string[] = [];
  try {
    await page.route(COMPARE, async (route) => {
      const id = siteIdOf(route.request().url());
      attempts.push(id);
      // The first site to ask is the one that fails, until the test "repairs" the server.
      failingId ??= id;
      if (id === failingId && !healed) return route.fulfill(serverError);
      return route.fulfill(ok(id));
    });
    await page.goto("/compare");

    // One automatic retry (1 s later), then the row gives up. The other two rows are complete.
    const errorRow = page.getByTestId("compare-row-error");
    await expect(errorRow).toHaveCount(1);
    await expect(page.getByTestId("compare-row")).toHaveCount(2);
    await expect(errorRow).toContainText("Could not work out this site.");
    await expect(errorRow).toContainText("Synthetic failure for the e2e test.");
    await expect(errorRow.getByRole("alert")).toBeVisible();
    expect(attempts.filter((id) => id === failingId)).toHaveLength(2);
    // Nothing is left spinning, so the progress line is gone.
    await expect(page.getByTestId("compare-progress")).toHaveCount(0);

    // Retry asks again for that site only, and its row fills in.
    healed = true;
    await page.getByTestId("compare-row-retry").click();
    await expect(page.getByTestId("compare-row")).toHaveCount(3);
    await expect(errorRow).toHaveCount(0);
    expect(attempts.filter((id) => id === failingId)).toHaveLength(3);
    // Per-site requests only: once every row is ready the summary (T-38) asks for all sites at once.
    expect(attempts.filter((id) => !id.includes(","))).toHaveLength(5);
  } finally {
    await cleanup(request, ids);
  }
});

test("a site that never answers times out after 90 seconds and offers Retry", async ({ page, request }) => {
  const ids = await registerTrio(request);
  let silentId: string | null = null;
  let healed = false;
  const asked: string[] = [];
  try {
    // A fake clock lets the test jump past the timeout instead of waiting for it.
    await page.clock.install();
    await page.route(COMPARE, async (route) => {
      const id = siteIdOf(route.request().url());
      asked.push(id);
      silentId ??= id;
      if (id === silentId && !healed) return; // never answered
      await route.fulfill(ok(id));
    });
    await page.goto("/compare");

    await expect(page.getByTestId("compare-row")).toHaveCount(2);
    await expect(page.getByTestId("compare-row-pending")).toHaveCount(1);
    await expect(page.getByTestId("compare-progress")).toContainText("Computing 2 of 3 sites");

    await page.clock.fastForward(91_000);
    const errorRow = page.getByTestId("compare-row-error");
    await expect(errorRow).toHaveCount(1);
    await expect(errorRow).toContainText("Took longer than 90 seconds");
    // A timeout is not repeated automatically: the site was asked for once.
    expect(asked.filter((id) => id === silentId)).toHaveLength(1);

    healed = true;
    await page.getByTestId("compare-row-retry").click();
    await expect(page.getByTestId("compare-row")).toHaveCount(3);
  } finally {
    await cleanup(request, ids);
  }
});
