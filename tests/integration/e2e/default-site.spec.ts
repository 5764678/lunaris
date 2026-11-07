import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * The first screen must show a site with its numbers, not "select a site". When cited demo sites
 * are registered, "Peak near Shackleton" is selected once without a click (so the camera flies
 * there and its timeline starts computing). A visitor who deselects it keeps an empty selection.
 * Runs against the live API; nothing here depends on lunar data, only on the registry.
 */

const API = "http://localhost:8100";
const DEFAULT_SITE = "Peak near Shackleton";

async function clearSites(request: APIRequestContext) {
  const { sites } = (await (await request.get(`${API}/api/v1/sites`)).json()) as { sites: { id: string }[] };
  for (const { id } of sites) await request.delete(`${API}/api/v1/sites/${id}`);
}

async function registerTrio(request: APIRequestContext) {
  const response = await request.post(`${API}/api/v1/catalog/demo-trio/register`);
  expect(response.ok()).toBe(true);
}

test("opens with the best-known cited site already selected", async ({ page, request }) => {
  await clearSites(request);
  await registerTrio(request);
  try {
    await page.goto("/");
    // No click: the site card and the site list already show Peak near Shackleton.
    await expect(page.getByTestId("selected-site-name")).toHaveText(DEFAULT_SITE);
    const row = page.getByTestId("site-list").locator("li", { hasText: DEFAULT_SITE });
    await expect(row.locator("button[aria-pressed]")).toHaveAttribute("aria-pressed", "true");
    // The timeline is working on that site instead of waiting for one to be chosen.
    await expect(page.locator('[data-lane="sun"]')).not.toContainText("select a site");
  } finally {
    await clearSites(request);
  }
});

test("a visitor who deselects the site keeps an empty selection", async ({ page, request }) => {
  await clearSites(request);
  await registerTrio(request);
  // A site of the visitor's own. Deleting it from the list is how the registry changes below: a
  // cited site is not a safe choice for that, because a server may give those no delete button.
  const ownName = `E2E own site ${Date.now()}`;
  const created = await request.post(`${API}/api/v1/sites`, {
    data: { name: ownName, latitude_deg: -89.2, longitude_deg: 12.5 },
  });
  expect(created.ok()).toBe(true);
  try {
    await page.goto("/");
    await expect(page.getByTestId("selected-site-name")).toHaveText(DEFAULT_SITE);
    const list = page.getByTestId("site-list");
    const row = list.locator("li", { hasText: DEFAULT_SITE });
    await row.locator("button[aria-pressed]").click();
    await expect(row.locator("button[aria-pressed]")).toHaveAttribute("aria-pressed", "false");

    // The registry changes (another site is deleted, the list is fetched again): still no selection.
    const other = list.locator("li", { hasText: ownName });
    await other.getByRole("button", { name: `Delete ${ownName}` }).click();
    await other.getByRole("button", { name: `Confirm deletion of ${ownName}` }).click();
    await expect(other).toHaveCount(0);
    await expect(page.getByTestId("selected-site-name")).toHaveCount(0);
    await expect(row.locator("button[aria-pressed]")).toHaveAttribute("aria-pressed", "false");
  } finally {
    await clearSites(request);
  }
});

test("with an empty registry nothing is selected; adding the cited sites selects the default", async ({
  page,
  request,
}) => {
  await clearSites(request);
  try {
    await page.goto("/");
    const card = page.getByTestId("catalog-trio");
    await expect(card.getByRole("button", { name: "Add 3 cited sites" })).toBeVisible();
    await expect(page.getByTestId("selected-site-name")).toHaveCount(0);

    await card.getByRole("button", { name: "Add 3 cited sites" }).click();
    await expect(page.getByTestId("selected-site-name")).toHaveText(DEFAULT_SITE);
  } finally {
    await clearSites(request);
  }
});

test("a registry with only user-entered sites selects nothing", async ({ page, request }) => {
  await clearSites(request);
  const name = `E2E own site ${Date.now()}`;
  const created = await request.post(`${API}/api/v1/sites`, {
    data: { name, latitude_deg: -89.2, longitude_deg: 12.5 },
  });
  expect(created.ok()).toBe(true);
  try {
    await page.goto("/");
    await expect(page.getByTestId("site-list").locator("li", { hasText: name })).toBeVisible();
    await expect(page.getByTestId("selected-site-name")).toHaveCount(0);
  } finally {
    await clearSites(request);
  }
});
