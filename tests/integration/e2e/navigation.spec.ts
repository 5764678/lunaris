import { expect, test } from "@playwright/test";

/** T-39: every navigation item leads to a real page; pages still being built say so. */

const NAV = [
  ["overview", "/"],
  ["illumination", "/illumination"],
  ["terrain", "/terrain"],
  ["compare", "/compare"],
  ["data", "/data"],
] as const;

test("every nav item is a link to a page that renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("nav[aria-label=Modules] a")).toHaveCount(NAV.length);
  await expect(page.locator("nav[aria-label=Modules] [aria-disabled=true]")).toHaveCount(0);
  for (const [id, href] of NAV) {
    const link = page.getByTestId(`nav-${id}`);
    await expect(link).toHaveAttribute("href", href);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${href === "/" ? "/$" : href}`));
    await expect(page.getByTestId(`nav-${id}`)).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: /404|not found/i })).toHaveCount(0);
  }
  // Merged into pages: no nav item of their own.
  const nav = page.locator("nav[aria-label=Modules]");
  await expect(nav.getByText("Celestial Geometry")).toHaveCount(0);
  await expect(nav.getByText("Mission Intelligence")).toHaveCount(0);
});

for (const [path, title] of [
  ["/illumination", "Illumination & Earth"],
  ["/terrain", "Terrain"],
] as const) {
  test(`${path} says it is in progress and links to where its outputs already appear`, async ({ page }) => {
    await page.goto(path);
    const body = page.getByTestId("page-in-progress");
    await expect(body).toContainText("In progress");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(body.getByRole("link").first()).toBeVisible();
  });
}

test("readiness keeps listing only served, displayed modules as available", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("readiness-analysis")).toHaveText(/M05 · available/i);
});
