import { expect, test } from "@playwright/test";

/**
 * T-03 (UI): the cited demo trio from GET /api/v1/catalog/sites is added in one action,
 * each site shows its source and that its coordinates are a DEM tile centre, not a
 * landing point. Runs against the live API (the catalogue ships with the API).
 */

const API = "http://localhost:8100";

test("adds the cited demo trio in one action, with sources and the tile-centre note", async ({
  page,
  request,
}) => {
  const catalog = (await (await request.get(`${API}/api/v1/catalog/sites`)).json()) as {
    sites: { name: string; demo_trio: boolean }[];
  };
  const trio = catalog.sites.filter((s) => s.demo_trio).map((s) => s.name);
  expect(trio).toHaveLength(3);

  try {
    await page.goto("/");
    const card = page.getByTestId("catalog-trio");
    for (const name of trio) await expect(card).toContainText(name);
    await expect(card).toContainText("Tile centre, not a landing point.");
    await expect(card.getByRole("link", { name: /PGDA product 78/ })).toHaveAttribute(
      "href",
      "https://pgda.gsfc.nasa.gov/products/78",
    );

    await card.getByRole("button", { name: "Add 3 cited sites" }).click();
    await expect(card.getByRole("button", { name: "All added" })).toBeDisabled();

    const list = page.getByTestId("site-list");
    for (const name of trio) {
      const row = list.locator("li", { hasText: name });
      await expect(row).toBeVisible();
      await expect(row.locator('[data-evidence="derived_product"]')).toHaveText("CITED");
    }

    await list.locator("li", { hasText: trio[0]! }).locator("button[aria-pressed]").click();
    await expect(page.getByTestId("selected-site-name")).toHaveText(trio[0]!);
    await expect(page.getByTestId("selected-site-source")).toContainText("PGDA");
    await expect(page.getByTestId("selected-site-source")).toContainText("Tile centre, not a landing point.");
    await expect(page.getByText("ships no curated site list")).toHaveCount(0);
  } finally {
    const { sites } = (await (await request.get(`${API}/api/v1/sites`)).json()) as {
      sites: { id: string; name: string }[];
    };
    for (const site of sites.filter((s) => trio.includes(s.name))) {
      await request.delete(`${API}/api/v1/sites/${site.id}`);
    }
  }
});
