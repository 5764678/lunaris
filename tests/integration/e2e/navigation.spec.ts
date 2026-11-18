import { expect, test } from "@playwright/test";

/** T-39: every navigation item leads to a real page; pages still being built say so. */

const NAV = [
  ["overview", "/"],
  ["learn", "/learn"],
  ["illumination", "/illumination"],
  ["terrain", "/terrain"],
  ["compare", "/compare"],
  ["data", "/data"],
  ["about", "/about"],
] as const;

test("every nav item is a link to a page that renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-testid=main-nav] a")).toHaveCount(NAV.length);
  await expect(page.locator("[data-testid=main-nav] [aria-disabled=true]")).toHaveCount(0);
  for (const [id, href] of NAV) {
    const link = page.getByTestId(`nav-${id}`);
    await expect(link).toHaveAttribute("href", href);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${href === "/" ? "/$" : href}`));
    await expect(page.getByTestId(`nav-${id}`)).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: /404|not found/i })).toHaveCount(0);
  }
  // Merged into pages: no nav item of their own.
  const nav = page.locator("[data-testid=main-nav]");
  await expect(nav.getByText("Celestial Geometry")).toHaveCount(0);
  await expect(nav.getByText("Mission Intelligence")).toHaveCount(0);
});

test("/illumination is the real illumination page (T-27)", async ({ page }) => {
  await page.goto("/illumination");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Illumination & Earth visibility");
});

test("/terrain is the real terrain page (T-19)", async ({ page }) => {
  await page.goto("/terrain");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Site terrain");
});

test("readiness keeps listing only served, displayed modules as available", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("readiness-analysis")).toHaveText(/M05 · available/i);
});
