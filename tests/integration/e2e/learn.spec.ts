import { expect, test, type Page } from "@playwright/test";

/**
 * The /learn route (K-03, K-04). It reads the committed lesson pack, static files served with
 * the web app (decision D10, contract L3). Expected values come from the pack's own manifest
 * (new Moon 7 Jan 2027 20:24 UTC to 6 Feb 2027 15:56 UTC), not from a calculation here.
 */

const API_ORIGIN = "http://localhost:8100";
const PERIODS = [1, 2, 3, 4, 5, 6] as const;

/** Blocks the API origin and records every request the page makes. */
async function watchRequests(page: Page) {
  const apiRequests: string[] = [];
  const origins = new Set<string>();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol === "http:" || url.protocol === "https:") origins.add(url.origin);
    if (request.url().startsWith(API_ORIGIN)) apiRequests.push(request.url());
  });
  await page.route(`${API_ORIGIN}/**`, (route) => route.abort("connectionrefused"));
  return { apiRequests, origins };
}

test("every step opens, and the lesson route never calls the API host", async ({ page }) => {
  const { apiRequests, origins } = await watchRequests(page);

  await page.goto("/learn");
  await expect(page.getByTestId("learn-index")).toBeVisible();
  await expect(page.getByTestId("step-nav").getByRole("link")).toHaveCount(6);

  for (const period of PERIODS) {
    await page.goto(`/learn/${period}`);
    await expect(page.getByTestId("learn-step")).toHaveAttribute("data-period", String(period));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId(`step-link-${period}`)).toHaveAttribute("aria-current", "step");
    // The shell's API status chips and the waking banner are not mounted on the lesson route.
    await expect(page.getByTestId("api-status")).toHaveCount(0);
    await expect(page.getByTestId("data-status")).toHaveCount(0);
  }
  await page.waitForTimeout(500);

  expect(apiRequests, "requests to the API host").toEqual([]);
  expect([...origins], "every request stays on the web origin").toEqual(["http://localhost:3100"]);
});

test("the nav has a Learn entry that stays active on a step", async ({ page }) => {
  await page.goto("/learn/3");
  await expect(page.getByTestId("nav-learn")).toHaveAttribute("href", "/learn");
  await expect(page.getByTestId("nav-learn")).toHaveAttribute("aria-current", "page");
});

test("a step number that is not one of the six is a 404", async ({ page }) => {
  const response = await page.goto("/learn/7");
  expect(response?.status()).toBe(404);
});

test("period 2: pack label, Earth view, phase readout stepping through the lunation", async ({ page }) => {
  await watchRequests(page);
  await page.goto("/learn/2");

  // The real pack: its label shows, and no synthetic-data banner.
  await expect(page.getByTestId("pack-label")).toBeVisible();
  await expect(page.getByTestId("synthetic-banner")).toHaveCount(0);
  await expect(page.getByTestId("evidence-kind")).toHaveText("model");
  await expect(page.getByTestId("epoch")).toHaveText("2027-01-07 20:00");
  await expect(page.getByTestId("earth-view-canvas")).toBeVisible();

  // Day 1 is the new Moon.
  await expect(page.getByTestId("percent-lit")).toHaveText("0%");
  await expect(page.getByTestId("phase-name")).toHaveAttribute("data-phase", "new");
  await expect(page.getByTestId("phase-name")).toHaveText("จันทร์ดับ");

  // The geocentric note (D12) is always there, and says nothing about Thailand's sky being shown.
  await expect(page.getByTestId("geocentric-note")).toContainText("จุดศูนย์กลางโลก");
  await expect(page.getByTestId("geocentric-note")).toContainText("ประเทศไทย");

  // Eight days in (the first quarter is 7 Jan + 8 d 0 h 10 min): waxing, a half.
  for (let i = 0; i < 8; i++) await page.getByTestId("step-forward").click();
  await expect(page.getByTestId("day-label")).toContainText("9");
  await expect(page.getByTestId("waxing-waning")).toHaveAttribute("data-waxing", "true");
  await expect(page.getByTestId("phase-name")).toHaveAttribute("data-phase", "firstQuarter");

  // Day 16 (the full Moon is 22 Jan 12:17 UTC): full. Day 23 (last quarter 29 Jan 10:55): waning, a half.
  for (let i = 0; i < 7; i++) await page.getByTestId("step-forward").click();
  await expect(page.getByTestId("phase-name")).toHaveAttribute("data-phase", "full");
  for (let i = 0; i < 7; i++) await page.getByTestId("step-forward").click();
  await expect(page.getByTestId("waxing-waning")).toHaveAttribute("data-waxing", "false");
  await expect(page.getByTestId("phase-name")).toHaveAttribute("data-phase", "lastQuarter");

  await page.getByTestId("step-restart").click();
  await expect(page.getByTestId("percent-lit")).toHaveText("0%");

  // No claims about what is not built.
  const text = (await page.getByTestId("learn-step").innerText()).toLowerCase();
  expect(text).not.toMatch(/tide|moonrise|น้ำขึ้นน้ำลง.*แอปแสดง/);
});

test("the language switch changes the lesson text and the readout names", async ({ page }) => {
  await watchRequests(page);
  await page.goto("/learn/2");
  await expect(page.locator("html")).toHaveAttribute("lang", "th");
  // The canvas only mounts after hydration; a click before that would be lost.
  await expect(page.getByTestId("earth-view-canvas")).toBeVisible();
  await page.getByTestId("lang-en").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByTestId("phase-name")).toHaveText("New Moon");
  await expect(page.getByTestId("geocentric-note")).toContainText("centre of the Earth");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("One lunation of phases");
});

test("when the pack cannot be loaded the lesson says so and shows no numbers", async ({ page }) => {
  await watchRequests(page);
  await page.route("**/lesson-pack/v1/manifest.json", (route) =>
    route.fulfill({ status: 404, body: "gone" }),
  );
  await page.goto("/learn/2");
  await expect(page.getByTestId("learn-step").getByRole("alert")).toContainText("โหลดข้อมูลบทเรียนไม่สำเร็จ");
  await expect(page.getByTestId("percent-lit")).toHaveCount(0);
  await expect(page.getByTestId("earth-view-canvas")).toHaveCount(0);
});

test("period 4: sky chart from the pack, sunlit fractions with and without terrain, the near-dark example", async ({
  page,
}) => {
  const { apiRequests } = await watchRequests(page);
  await page.goto("/learn/4");
  await expect(page.getByTestId("stand-site")).toContainText("Peak near Shackleton");
  await expect(page.getByTestId("synthetic-banner")).toHaveCount(0);
  await expect(page.getByTestId("lesson-sky-chart")).toHaveAttribute("data-plot-state", "ready");
  // Sun and Earth tracks are both drawn.
  await expect(page.getByTestId("lesson-sky-chart")).toHaveAttribute("data-track-count", "2");

  // Values are the pack's own (manifest terrain_sunlit_fraction 0.9623 for Peak near Shackleton).
  await expect(page.getByTestId("flat-pgda78-site07")).toHaveText("67.7 %");
  await expect(page.getByTestId("terrain-pgda78-site07")).toHaveText("96.2 %");
  await expect(page.getByTestId("terrain-pgda78-site01")).toHaveText("91.5 %");
  await expect(page.getByTestId("terrain-pgda78-site23")).toHaveText("65.8 %");

  // No 0 % site exists: the near-dark example is Amundsen 1, with its source.
  await expect(page.getByTestId("darkest-terrain")).toHaveText("1.4 %");
  await expect(page.getByTestId("no-zero-site")).toBeVisible();
  await expect(page.getByTestId("near-dark")).toContainText("Amundsen 1");
  await expect(page.getByTestId("near-dark-source")).toContainText("shadowed_scan");

  // The evidence label folds away; the answers to the reading questions are folded too.
  await expect(page.getByTestId("stand-evidence-kind")).toContainText("calculation");
  await expect(page.getByTestId("stand-check")).not.toHaveAttribute("open", "");

  await page.waitForTimeout(300);
  expect(apiRequests, "requests to the API host").toEqual([]);
});

test("period 5: mission answers pick a packed variant; the recommendation is a claim to examine", async ({
  page,
}) => {
  const { apiRequests } = await watchRequests(page);
  await page.goto("/learn/5");
  await expect(page.getByTestId("claim-site")).toContainText("Peak near Shackleton");
  await expect(page.getByTestId("default-note")).toBeVisible();
  await expect(page.getByTestId("claim-score")).toContainText("71.3");
  await expect(page.getByTestId("claim-weights")).toContainText("33 %");
  // What the pick gives up is shown without using weights: Peak trails on roughness only.
  await expect(page.getByTestId("claim-trails")).toContainText("ความขรุขระ");
  await expect(page.getByTestId("compare-window")).toContainText("2570");

  // Every number carries its evidence kind; pressing one opens its evidence.
  await expect(page.getByTestId("kind-ad7f90fc-52e7-48b1-81fe-013d22e9d772-slope_at_site_deg")).toContainText(
    "การคำนวณ",
  );
  await expect(page.getByTestId("evidence-panel")).toContainText("ยังไม่ได้เลือกค่า");
  await page.getByTestId("cell-69e2d498-39a4-4c62-8ff5-10665dc865a0-sun_illuminated_fraction").click();
  await expect(page.getByTestId("panel-kind")).toContainText("การคำนวณ");
  await expect(page.getByTestId("panel-sources")).not.toBeEmpty();

  // Landing first: the claim changes to Malapert massif, with a narrow lead and what would flip it.
  await page.getByTestId("variant-landing-critical").check();
  await expect(page.getByTestId("answer-landing")).toHaveText("สำคัญมาก");
  await expect(page.getByTestId("claim-site")).toContainText("Malapert massif");
  await expect(page.getByTestId("claim")).toHaveAttribute("data-confidence", "narrow");
  await expect(page.getByTestId("claim-robustness")).toHaveAttribute("data-stable", "false");
  await expect(page.getByTestId("default-note")).toHaveCount(0);

  // Power first keeps Peak near Shackleton.
  await page.getByTestId("variant-power-critical").check();
  await expect(page.getByTestId("claim-site")).toContainText("Peak near Shackleton");
  await expect(page.getByTestId("claim-score")).toContainText("8");

  // English switch.
  await page.getByTestId("lang-en").click();
  await expect(page.getByTestId("answer-power")).toHaveText("Critical");

  await page.waitForTimeout(300);
  expect(apiRequests, "requests to the API host").toEqual([]);
});

test("periods 4 and 5 report a missing pack file and show no numbers", async ({ page }) => {
  await watchRequests(page);
  await page.route("**/lesson-pack/v1/compare/default.json", (route) =>
    route.fulfill({ status: 404, body: "gone" }),
  );
  await page.route("**/lesson-pack/v1/sites/pgda78-site07/timeline.json", (route) =>
    route.fulfill({ status: 404, body: "gone" }),
  );
  await page.goto("/learn/5");
  await expect(page.getByTestId("learn-step").getByRole("alert")).toContainText("โหลดข้อมูลบทเรียนไม่สำเร็จ");
  await expect(page.getByTestId("claim")).toHaveCount(0);
  await page.goto("/learn/4");
  await expect(page.getByTestId("learn-step").getByRole("alert")).toContainText("โหลดข้อมูลบทเรียนไม่สำเร็จ");
  await expect(page.getByTestId("sunlit-table")).toHaveCount(0);
});

for (const size of [
  { name: "phone", width: 390, height: 844 },
  { name: "projector", width: 1024, height: 768 },
]) {
  test(`${size.name} ${size.width}x${size.height}: no horizontal scroll, lesson text at least 14 px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await watchRequests(page);
    for (const period of PERIODS) {
      await page.goto(`/learn/${period}`);
      await expect(page.getByTestId("learn-step")).toBeVisible();
      if (period === 2) await expect(page.getByTestId("phase-readout")).toBeVisible();
      if (period === 4)
        await expect(page.getByTestId("lesson-sky-chart")).toHaveAttribute("data-plot-state", "ready");
      if (period === 5) await expect(page.getByTestId("claim")).toBeVisible();
      // Measure after the Thai web font has loaded: it is wider than the fallback.
      await page.evaluate(() => document.fonts.ready);
      const report = await page.evaluate(() => {
        const main = document.querySelector("[data-testid=learn-step]")!;
        const small: string[] = [];
        for (const el of main.querySelectorAll("p, li, dt, dd, a, button, span, summary, h1, h2, h3")) {
          const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim());
          if (!own) continue;
          const size = parseFloat(getComputedStyle(el).fontSize);
          if (size < 14) small.push(`${el.tagName} ${size}px "${el.textContent?.trim().slice(0, 30)}"`);
        }
        const workspace = document.getElementById("workspace")!;
        return {
          small,
          overflow: workspace.scrollWidth - workspace.clientWidth,
          page: document.documentElement.scrollWidth - window.innerWidth,
        };
      });
      expect(report.small, `period ${period}: text under 14 px`).toEqual([]);
      expect(report.overflow, `period ${period}: workspace horizontal overflow`).toBeLessThanOrEqual(0);
      expect(report.page, `period ${period}: page horizontal overflow`).toBeLessThanOrEqual(0);
    }
  });
}

for (const lang of ["th", "en"] as const) {
  test(`narrow navigation rail at 1100x720 (${lang}): no short title is cut off`, async ({ page }) => {
    await page.addInitScript((l) => window.localStorage.setItem("lunaris.lang", l), lang);
    await page.setViewportSize({ width: 1100, height: 720 });
    await watchRequests(page);
    await page.goto("/learn");
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await page.evaluate(() => document.fonts.ready);
    const cut = await page.evaluate(() =>
      [...document.querySelectorAll("nav[data-testid=main-nav] a span.truncate")]
        .filter((s) => s.scrollWidth > s.clientWidth)
        .map((s) => s.textContent),
    );
    expect(cut, "short titles wider than the rail").toEqual([]);
  });
}
