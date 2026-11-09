import { expect, test, type APIRequestContext, type Route } from "@playwright/test";

/**
 * A1: on a free hosting plan the API sleeps when idle and the first visit waits up to a minute.
 * While it wakes the page must say so ("Waking the server, this can take up to a minute"), not
 * show "Offline" or a page of red errors, and must fill in by itself once the server answers.
 *
 * The sleeping server is simulated by route interception: requests are held, then dropped.
 */

const API = "http://localhost:8100";
const HEALTH = /\/health$/;

/** Holds a request for `ms`, then runs `then` (a page that has closed meanwhile is not an error). */
async function holdThen(route: Route, ms: number, then: () => Promise<void>) {
  try {
    await new Promise((resolve) => setTimeout(resolve, ms));
    await then();
  } catch {
    // The test finished and the page closed while the request was held.
  }
}

async function registerTrio(request: APIRequestContext) {
  const response = await request.post(`${API}/api/v1/catalog/demo-trio/register`);
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { sites: { id: string }[] }).sites.map((s) => s.id);
}

async function cleanup(request: APIRequestContext, ids: string[]) {
  for (const id of ids) await request.delete(`${API}/api/v1/sites/${id}`);
}

test("a quick answer never shows the waking notice", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("api-status")).toHaveAttribute("data-state", "online");
  await expect(page.getByTestId("waking-banner")).toHaveCount(0);
});

test("a slow first answer shows the waking notice, which clears when the server answers", async ({
  page,
}) => {
  // `/health` is held until the notice is on screen, then answered. A fixed hold (it was 6 s) raced
  // the page's own 2 s timer, which a busy page start (software-rendered WebGL on a slow CI
  // runner) can delay by several seconds; holding until the notice shows tests the behaviour,
  // not the race. The 60 s cap only stops a broken page from hanging the test.
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(HEALTH, async (route) => {
    await Promise.race([released, new Promise((resolve) => setTimeout(resolve, 60_000))]);
    try {
      await route.continue();
    } catch {
      // The client gave up on this request (its 8 s limit) or the page closed meanwhile.
    }
  });
  await page.goto("/");

  const chip = page.getByTestId("api-status");
  const banner = page.getByTestId("waking-banner");
  await expect(banner).toContainText("Waking the server, this can take up to a minute.");
  await expect(chip).toHaveAttribute("data-state", "waking");
  await expect(chip).toContainText("Waking up");

  release();
  // A held request the client already gave up on is answered by the next poll (every 10 s).
  await expect(chip).toHaveAttribute("data-state", "online", { timeout: 25_000 });
  await expect(banner).toHaveCount(0);
});

test("while the server sleeps the page says so, not Offline or errors, and fills in by itself when it wakes", async ({
  page,
  request,
}) => {
  const ids = await registerTrio(request); // the cited sites exist, so the list has rows once the API answers
  try {
    let awake = false;
    let firstSiteRequestAt: number | null = null;
    await page.route(`${API}/**`, (route) => {
      if (firstSiteRequestAt === null && route.request().url().includes("/api/v1/sites")) {
        firstSiteRequestAt = Date.now();
      }
      if (awake) return route.continue();
      // A sleeping host: the request is held for a while, then fails.
      return holdThen(route, 2_200, () => route.abort("failed"));
    });
    await page.goto("/");

    const chip = page.getByTestId("api-status");
    await expect(page.getByTestId("waking-banner")).toBeVisible();
    await expect(chip).toHaveAttribute("data-state", "waking");

    // Long after a single retry would have given up and shown an error (about 7 s in), the list is
    // still loading and nothing red tells the visitor the API is unreachable.
    await expect
      .poll(() => (firstSiteRequestAt === null ? 0 : Date.now() - firstSiteRequestAt), { timeout: 30_000 })
      .toBeGreaterThan(14_000);
    await expect(page.getByLabel("Loading sites")).toBeVisible();
    await expect(page.getByTestId("site-list")).toHaveCount(0);
    await expect(page.getByRole("alert").filter({ hasText: /unreachable|did not respond/ })).toHaveCount(0);
    await expect(chip).toHaveAttribute("data-state", "waking");

    // The server wakes: the next health check succeeds and the page fills in without a reload.
    awake = true;
    await expect(chip).toHaveAttribute("data-state", "online", { timeout: 30_000 });
    await expect(page.getByTestId("waking-banner")).toHaveCount(0);
    await expect(page.getByTestId("site-list").locator("li")).toHaveCount(ids.length, { timeout: 15_000 });
  } finally {
    await cleanup(request, ids);
  }
});
