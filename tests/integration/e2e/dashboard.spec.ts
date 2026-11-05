import { expect, test, type Page } from "@playwright/test";

/**
 * Frontend ↔ backend integration through a real browser. Every assertion runs against
 * the live API started by playwright.config.ts (apps/web).
 */

/** Console noise that is expected and documented (see README § Known warnings). */
const EXPECTED_CONSOLE = [
  /textures\/moon\/manifest\.json/, // placeholder fallback probe: 404 until a texture is built
  /Failed to load resource: the server responded with a status of 404/,
  /THREE\.Clock: This module has been deprecated/, // emitted inside @react-three/fiber
  /\[Fast Refresh\]|Download the React DevTools|\[HMR\]/,
];

function collectUnexpectedConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") return;
    const text = message.text();
    if (!EXPECTED_CONSOLE.some((pattern) => pattern.test(text))) problems.push(`${message.type()}: ${text}`);
  });
  return problems;
}

test("dashboard connects to the API and discloses placeholders", async ({ page }) => {
  const problems = collectUnexpectedConsole(page);
  await page.goto("/");

  const status = page.getByTestId("api-status");
  await expect(status).toHaveAttribute("data-state", "online");
  await expect(status).toContainText("v0.1.0");

  await expect(page.getByTestId("moon-canvas").locator("canvas")).toBeVisible();
  await expect(page.getByTestId("surface-disclosure")).toContainText(/placeholder|NASA SVS/i);
  await expect(page.getByTestId("lighting-disclosure")).toContainText("not the computed Sun direction");
  await expect(page.getByTestId("data-status")).toContainText("/3 acquired");

  // Planned modules are visibly unavailable, not fake views.
  await expect(page.getByTestId("nav-planned-terrain")).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator("[data-lane]")).toHaveCount(4);
  await expect(page.locator("[data-lane]").first()).toContainText("Not computed");

  expect(problems).toEqual([]);
});

test("candidate site lifecycle through the UI", async ({ page }) => {
  const problems = collectUnexpectedConsole(page);
  await page.goto("/");
  await expect(page.getByTestId("api-status")).toHaveAttribute("data-state", "online");

  const name = `E2E site ${Date.now()}`;
  await page.getByLabel("Site name").fill(name);
  await page.getByLabel("Lat °").fill("-89.25");
  await page.getByLabel("Lon °E").fill("-60");
  await page.getByRole("button", { name: "Add site" }).click();

  // Server-normalized longitude (−60 → 300 °E) and automatic selection.
  const row = page.getByTestId("site-list").locator("li", { hasText: name });
  await expect(row).toContainText("300.000°E");
  await expect(page.getByTestId("selected-site-name")).toHaveText(name);
  await expect(page.locator('[data-evidence="calculation"]').first()).toBeVisible();

  // Two-step delete.
  await row.getByRole("button", { name: `Delete ${name}` }).click();
  await row.getByRole("button", { name: `Confirm deletion of ${name}` }).click();
  await expect(row).toHaveCount(0);

  expect(problems).toEqual([]);
});

test("client-side validation mirrors the API rules", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("api-status")).toHaveAttribute("data-state", "online");
  await page.getByLabel("Site name").fill("Out of range");
  await page.getByLabel("Lat °").fill("91");
  await page.getByLabel("Lon °E").fill("0");
  await page.getByRole("button", { name: "Add site" }).click();
  await expect(page.getByText("Latitude must be within −90…90°.")).toBeVisible();
});

test("data sources page shows provenance and toolchain", async ({ page }) => {
  const problems = collectUnexpectedConsole(page);
  await page.goto("/data");
  await expect(page.getByTestId("dataset-card")).toHaveCount(4);
  await expect(page.getByText("uv run lunaris-data acquire naif-generic-kernels-lunar")).toBeVisible();
  const runtime = page.getByTestId("runtime-table");
  await expect(runtime).toContainText("cspice");
  await expect(runtime).toContainText("gdal");
  expect(problems).toEqual([]);
});
