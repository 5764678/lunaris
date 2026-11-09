import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * A6: the cited demo sites are shared by every visitor, so the site list gives them no delete
 * button (a lock that says why instead), while sites a visitor added keep theirs. A cited site
 * that went missing (for example removed straight through the API) comes back with one click.
 */

const API = "http://localhost:8100";
const CITED = ["Connecting ridge", "Malapert massif", "Peak near Shackleton"];

async function registerTrio(request: APIRequestContext) {
  const response = await request.post(`${API}/api/v1/catalog/demo-trio/register`);
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { sites: { id: string }[] }).sites.map((s) => s.id);
}

/**
 * Removes every registered site, not just the ones this test made: a cited site brought back
 * from the page gets a new id, and one left behind would change what the next spec sees.
 */
async function clearSites(request: APIRequestContext) {
  const { sites } = (await (await request.get(`${API}/api/v1/sites`)).json()) as { sites: { id: string }[] };
  for (const { id } of sites) await request.delete(`${API}/api/v1/sites/${id}`);
}

test("cited sites show a lock, not a delete button; a visitor's own site keeps its delete button", async ({
  page,
  request,
}) => {
  await clearSites(request);
  await registerTrio(request);
  const ownName = `E2E own site ${Date.now()}`;
  const own = await request.post(`${API}/api/v1/sites`, {
    data: { name: ownName, latitude_deg: -89.2, longitude_deg: 40 },
  });
  expect(own.ok()).toBe(true);
  try {
    await page.goto("/");
    const list = page.getByTestId("site-list");
    for (const name of CITED) {
      const row = list.locator("li", { hasText: name });
      await expect(row.getByTestId("site-locked")).toHaveCount(1);
      await expect(row.getByRole("button", { name: /^Delete / })).toHaveCount(0);
    }
    const mine = list.locator("li", { hasText: ownName });
    await expect(mine.getByRole("button", { name: `Delete ${ownName}` })).toBeVisible();
    await expect(mine.getByTestId("site-locked")).toHaveCount(0);

    // The lock explains itself, to the mouse and to the keyboard.
    const lock = list.locator("li", { hasText: CITED[0]! }).getByTestId("site-locked");
    await expect(lock).toHaveAccessibleName(`${CITED[0]} is a cited demo site and cannot be deleted`);
    await lock.focus();
    await expect(page.getByRole("tooltip")).toContainText("Cited demo sites cannot be deleted");
  } finally {
    await clearSites(request);
  }
});

test("a cited site that went missing comes back with one click", async ({ page, request }) => {
  await clearSites(request);
  const ids = await registerTrio(request);
  try {
    await request.delete(`${API}/api/v1/sites/${ids[0]}`); // removed straight through the API
    await page.goto("/");
    const list = page.getByTestId("site-list");
    await expect(list.locator("li")).toHaveCount(2);
    await page.getByRole("button", { name: "Add 1 cited site" }).click();
    await expect(list.locator("li")).toHaveCount(3);
    await expect(list.getByTestId("site-locked")).toHaveCount(3);
  } finally {
    await clearSites(request);
  }
});
