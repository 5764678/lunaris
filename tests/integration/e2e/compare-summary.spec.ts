import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * T-38: the comparison summary (T-18) on the Compare page. Deterministic tests serve a SYNTHETIC
 * comparison (labelled in its evidence; not lunar results) for the real registered demo trio, with
 * a summary built from the request: leaders, standings, a verdict and a recommendation built from
 * the mission answers in the query. One test runs against the live API.
 */

const API = "http://localhost:8100";
const COMPARE = /\/api\/v1\/analysis\/site-comparison\?/;

const evidence = {
  kind: "calculation",
  statement: "SYNTHETIC E2E FIXTURE.",
  sources: [],
  method: "synthetic",
  assumptions: [],
};
const cell = (value: number | null, unit: string) => ({
  value,
  unit,
  baseline_m: null,
  reason: value === null ? "terrain illumination not available" : null,
  evidence: value === null ? null : evidence,
  limitations: [],
});

const COLUMNS = [
  {
    key: "surface_height_m",
    label: "Height",
    unit: "m",
    better: null,
    better_rationale: "No universal direction.",
  },
  {
    key: "slope_at_site_deg",
    label: "Slope at site",
    unit: "deg",
    better: "lower",
    better_rationale: "Gentler is safer.",
  },
  {
    key: "roughness_rms_m",
    label: "Roughness",
    unit: "m",
    better: "lower",
    better_rationale: "Smoother is safer.",
  },
  {
    key: "sun_mean_visible_disk_fraction",
    label: "Sun: mean visible disk",
    unit: "fraction",
    better: "higher",
    better_rationale: "More power.",
  },
];

/** SYNTHETIC recommendation: the first site, or the gentlest one when a slope limit is given. */
function recommendation(
  ids: string[],
  at: (id: string) => number,
  name: (id: string) => string,
  power: string,
  maxSlope: string | null,
) {
  const slope = (id: string) => [2, 4, 6][at(id)] ?? 6;
  const excluded = (id: string) => maxSlope !== null && slope(id) > Number(maxSlope);
  const pick = ids.find((id) => at(id) === 0 && !excluded(id)) ?? ids.find((id) => !excluded(id)) ?? null;
  return {
    mission: {
      power,
      comms: "medium",
      landing: "medium",
      limits: { max_slope_deg: maxSlope === null ? null : Number(maxSlope) },
    },
    site_id: pick,
    name: pick === null ? null : name(pick),
    runner_up_site_id: null,
    margin: null,
    confidence: pick === null ? "none" : "clear",
    headline: pick === null ? "SYNTHETIC: no site meets the limits." : `SYNTHETIC pick: ${name(pick)}.`,
    reasons: pick === null ? [] : ["SYNTHETIC reason."],
    tradeoffs: [],
    caveats: [],
    robustness: { tested: 6, held: 6, flips: [], statement: "SYNTHETIC: stable." },
    needs: [
      { need: "power", label: "Sunlight and power", priority: power, weight: 1 / 3 },
      { need: "comms", label: "Direct-to-Earth comms", priority: "medium", weight: 1 / 3 },
      { need: "landing", label: "Landing safety", priority: "medium", weight: 1 / 3 },
    ],
    scales: [],
    ranking: ids.map((id) =>
      excluded(id)
        ? {
            site_id: id,
            name: name(id),
            status: "excluded",
            rank: null,
            score: null,
            need_scores: {},
            reasons: [`SYNTHETIC: slope over the ${maxSlope}° limit`],
          }
        : {
            site_id: id,
            name: name(id),
            status: id === pick ? "recommended" : "ranked",
            rank: at(id) + 1,
            score: 0.7 - at(id) * 0.1,
            need_scores: { power: 0.5, comms: 0.5, landing: 0.5 },
            reasons: [],
          },
    ),
    method: "SYNTHETIC recommendation method.",
    evidence: {
      kind: "assumption",
      statement: "SYNTHETIC mission-fit weights chosen by LUNARIS, not mission requirements.",
      sources: [],
      method: "synthetic",
      assumptions: ["SYNTHETIC weight Sunlit, average = 0.133"],
    },
  };
}

function synthetic(url: string, names: Map<string, string>) {
  const query = new URL(url).searchParams;
  const ids = query.get("site_ids")!.split(",");
  const power = query.get("power") ?? "medium";
  const maxSlope = query.get("max_slope_deg");
  // Site 0 is the gentlest, site 1 the smoothest; site 2 is worst on both.
  const slope = (i: number) => [2, 4, 6][i] ?? 6;
  const rough = (i: number) => [0.5, 0.3, 0.7][i] ?? 0.7;
  const order = [...names.keys()];
  const at = (id: string) => order.indexOf(id);
  const name = (id: string) => names.get(id) ?? id;
  const rows = ids.map((id) => ({
    site_id: id,
    name: name(id),
    origin: "published",
    latitude_deg: -89,
    longitude_deg: 0,
    surface_height_m: cell(1000, "m"),
    slope_at_site_deg: cell(slope(at(id)), "deg"),
    roughness_rms_m: cell(rough(at(id)), "m"),
    sun_mean_visible_disk_fraction: cell(null, "fraction"),
  }));
  const best = (f: (i: number) => number) => ids.reduce((a, b) => (f(at(b)) < f(at(a)) ? b : a));
  const worst = (f: (i: number) => number) => ids.reduce((a, b) => (f(at(b)) > f(at(a)) ? b : a));
  const multi = ids.length > 1;
  return {
    start_utc: "2027-01-01T00:00:00Z",
    end_utc: "2028-01-01T00:00:00Z",
    step_s: 3600,
    sample_count: 8761,
    observer_height_m: 2,
    footprint_radius_m: 50,
    assumptions: [],
    columns: COLUMNS.map((c) => ({ ...c, description: c.label })),
    rows,
    summary: {
      leaders: [
        {
          key: "slope_at_site_deg",
          better: "lower",
          site_ids: multi ? [best(slope)] : [],
          value: multi ? 2 : null,
          compared_sites: ids.length,
        },
        {
          key: "roughness_rms_m",
          better: "lower",
          site_ids: multi ? [best(rough)] : [],
          value: multi ? 0.3 : null,
          compared_sites: ids.length,
        },
        {
          key: "sun_mean_visible_disk_fraction",
          better: "higher",
          site_ids: [],
          value: null,
          compared_sites: 0,
        },
      ],
      sites: ids.map((id) => ({
        site_id: id,
        name: name(id),
        leads: [
          ...(best(slope) === id ? ["slope_at_site_deg"] : []),
          ...(best(rough) === id ? ["roughness_rms_m"] : []),
        ],
        trails: worst(slope) === id ? ["slope_at_site_deg", "roughness_rms_m"] : [],
        directed_compared: 2,
        dominated_by: worst(slope) === id ? [best(slope)] : [],
        dominance: `SYNTHETIC standing of ${name(id)}.`,
      })),
      verdict: "SYNTHETIC verdict: no single site is best on every directed metric.",
      method: "SYNTHETIC method: leaders and Pareto dominance over directed columns.",
      recommendation: recommendation(ids, at, name, power, maxSlope),
    },
  };
}

async function registerTrio(request: APIRequestContext) {
  const response = await request.post(`${API}/api/v1/catalog/demo-trio/register`);
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { sites: { id: string; name: string }[] }).sites;
}

async function cleanup(request: APIRequestContext, ids: string[]) {
  for (const id of ids) await request.delete(`${API}/api/v1/sites/${id}`);
}

/** Serves the synthetic comparison; returns the query strings of the multi-site requests. */
async function serve(page: Page, names: Map<string, string>, failSummary = false) {
  const summaryRequests: URLSearchParams[] = [];
  await page.route(COMPARE, (route) => {
    const params = new URL(route.request().url()).searchParams;
    const multi = params.get("site_ids")!.includes(",");
    if (multi) summaryRequests.push(params);
    if (multi && failSummary)
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "internal", message: "Synthetic failure.", details: [], request_id: "e2e" },
        }),
      });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(synthetic(route.request().url(), names)),
    });
  });
  return summaryRequests;
}

test("verdict, standings and column leaders; the default mission still names a site", async ({
  page,
  request,
}) => {
  const sites = await registerTrio(request);
  const names = new Map(sites.map((s) => [s.id, s.name]));
  const [gentle, smooth, worst] = sites;
  try {
    const summaryRequests = await serve(page, names);
    await page.goto("/compare");
    await expect(page.getByTestId("compare-row")).toHaveCount(3);

    const summary = page.getByTestId("compare-summary");
    await expect(summary).toHaveAttribute("data-state", "ready");
    await expect(page.getByTestId("compare-verdict")).toHaveText(
      "SYNTHETIC verdict: no single site is best on every directed metric.",
    );
    const standing = (id: string) => page.locator(`[data-testid="compare-standing"][data-site-id="${id}"]`);
    await expect(standing(gentle!.id).getByTestId("compare-standing-leads")).toHaveText(
      "Leads: Slope at site",
    );
    await expect(standing(smooth!.id).getByTestId("compare-standing-leads")).toHaveText("Leads: Bumpiness");
    await expect(standing(worst!.id).getByTestId("compare-standing-trails")).toHaveText(
      "Trails: Slope at site, Bumpiness",
    );
    await expect(standing(worst!.id)).toHaveAttribute("data-dominated", "true");
    await expect(standing(worst!.id)).toContainText(`SYNTHETIC standing of ${worst!.name}.`);

    // Leaders: one marked cell per ranked column with values; nothing for a column without values.
    const table = page.getByTestId("compare-table");
    const row = (name: string) => table.getByTestId("compare-row").filter({ hasText: name });
    await expect(table.getByTestId("leader-mark")).toHaveCount(2);
    await expect(row(gentle!.name).locator('td[data-leader="true"]')).toContainText("2.00°");
    await expect(row(smooth!.name).locator('td[data-leader="true"]')).toContainText("best");
    await expect(row(worst!.name).locator('td[data-leader="true"]')).toHaveCount(0);

    // Every header states its ranking direction; a column without one says it is not ranked.
    await expect(page.getByTestId("col-direction-slope_at_site_deg")).toHaveText("↓ lower is better");
    await expect(page.getByTestId("col-direction-sun_mean_visible_disk_fraction")).toHaveText(
      "↑ higher is better",
    );
    await expect(page.getByTestId("col-direction-surface_height_m")).toHaveText("not ranked");

    // Unanswered questions: the request carries no mission answers, yet a site is named.
    await expect(page.getByTestId("compare-mission-default")).toBeVisible();
    await expect(page.getByTestId("compare-recommendation-name")).toHaveText(gentle!.name);
    expect(summaryRequests.length).toBeGreaterThan(0);
    expect(summaryRequests.every((p) => !p.has("power") && !p.has("max_slope_deg"))).toBe(true);
  } finally {
    await cleanup(
      request,
      sites.map((s) => s.id),
    );
  }
});

test("mission answers are sent to the API; a limit excludes sites with the reason; Reset clears them", async ({
  page,
  request,
}) => {
  const sites = await registerTrio(request);
  const names = new Map(sites.map((s) => [s.id, s.name]));
  const [gentle, smooth, worst] = sites;
  try {
    const summaryRequests = await serve(page, names);
    await page.goto("/compare");
    await expect(page.getByTestId("compare-summary")).toHaveAttribute("data-state", "ready");

    await page.getByTestId("compare-need-power-high").click();
    await expect.poll(() => summaryRequests.some((p) => p.get("power") === "high")).toBe(true);
    await expect(page.getByTestId("compare-recommendation")).toHaveAttribute("data-confidence", "clear");
    await expect(
      page.getByTestId("compare-recommendation").locator('[data-evidence="assumption"]'),
    ).toBeVisible();
    await expect(page.getByTestId("compare-ranking-entry")).toHaveCount(3);
    await expect(page.getByTestId("compare-robustness")).toHaveText("SYNTHETIC: stable.");

    // A hard limit: sites over it are excluded and say why, never given a number.
    await page.getByText("Hard limits (optional)").click();
    const limit = page.getByTestId("compare-limit-maxSlopeDeg");
    await limit.fill("3");
    await limit.press("Enter");
    await expect.poll(() => summaryRequests.some((p) => p.get("max_slope_deg") === "3")).toBe(true);
    await expect(page.getByTestId("compare-recommendation-name")).toHaveText(gentle!.name);
    const excluded = page.locator('[data-testid="compare-ranking-entry"][data-status="excluded"]');
    await expect(excluded).toHaveCount(2);
    await expect(excluded.first()).toContainText("Excluded: SYNTHETIC: slope over the 3° limit");
    await expect(page.getByText(smooth!.name).first()).toBeVisible();
    await expect(page.getByText(worst!.name).first()).toBeVisible();

    // The verdict does not change with the answers: it never comes from weights.
    await expect(page.getByTestId("compare-verdict")).toHaveText(
      "SYNTHETIC verdict: no single site is best on every directed metric.",
    );

    await page.getByTestId("compare-mission-reset").click();
    await expect(page.getByTestId("compare-mission-default")).toBeVisible();
    await expect(page.locator('[data-testid="compare-ranking-entry"][data-status="excluded"]')).toHaveCount(
      0,
    );
  } finally {
    await cleanup(
      request,
      sites.map((s) => s.id),
    );
  }
});

test("a failed summary says so with Retry; the table rows stay", async ({ page, request }) => {
  const sites = await registerTrio(request);
  const names = new Map(sites.map((s) => [s.id, s.name]));
  try {
    await serve(page, names, true);
    await page.goto("/compare");
    await expect(page.getByTestId("compare-row")).toHaveCount(3);
    const summary = page.getByTestId("compare-summary");
    await expect(summary).toHaveAttribute("data-state", "error", { timeout: 30_000 });
    await expect(summary.getByRole("alert")).toContainText("Could not summarise the sites.");
    await expect(page.getByTestId("compare-summary-retry")).toBeVisible();
    await expect(page.getByTestId("leader-mark")).toHaveCount(0);
  } finally {
    await cleanup(
      request,
      sites.map((s) => s.id),
    );
  }
});

test("live API: the summary ends ready, with its own error, or says which sites it still needs", async ({
  page,
  request,
}) => {
  const sites = await registerTrio(request);
  try {
    await page.goto("/compare");
    const summary = page.getByTestId("compare-summary");
    await expect(
      summary.and(page.locator('[data-state="ready"], [data-state="error"], [data-state="incomplete"]')),
    ).toBeVisible({ timeout: 120_000 });
    if ((await summary.getAttribute("data-state")) === "ready") {
      await expect(page.getByTestId("compare-verdict")).not.toBeEmpty();
      await expect(page.getByTestId("compare-standing")).toHaveCount(3);
      await expect(page.getByTestId("compare-recommendation")).toBeVisible();
    }
  } finally {
    await cleanup(
      request,
      sites.map((s) => s.id),
    );
  }
});
