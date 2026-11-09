import { expect, test } from "@playwright/test";

/**
 * Analysis readiness shows each module's input data once per kind ("terrain", "ephemeris"), not once
 * per dataset: Terrain Intelligence used to read "terrain, terrain" (the 240 m and the 20 m DEM) and
 * Mission Intelligence "terrain, ephemeris, terrain". Runs against the real dataset list.
 *
 * The milestone chips keep the roadmap's ids (Illumination and Earth visibility are both M04 in
 * docs/ROADMAP.md) and name the milestone on hover.
 */

const INPUTS: Record<string, string[]> = {
  "Terrain Intelligence": ["terrain"],
  "Celestial Geometry": ["ephemeris"],
  Illumination: ["terrain", "ephemeris"],
  "Earth Visibility": ["terrain", "ephemeris"],
  "Mission Intelligence": ["terrain", "ephemeris"],
};

test("each module lists a kind of input data once", async ({ page }) => {
  await page.goto("/");
  const panel = page.getByRole("region", { name: "Analysis readiness" });
  await expect(panel).toBeVisible();

  for (const [title, expected] of Object.entries(INPUTS)) {
    const row = panel.locator("li").filter({ has: page.getByText(title, { exact: true }) });
    await expect(row.getByTestId("readiness-input"), title).toHaveText(expected);
  }
});

test("a merged input tag lists every dataset behind it when hovered", async ({ page }) => {
  await page.goto("/");
  const panel = page.getByRole("region", { name: "Analysis readiness" });
  const row = panel.locator("li").filter({ has: page.getByText("Terrain Intelligence", { exact: true }) });
  const tag = row.getByTestId("readiness-input");
  // Two terrain datasets (240 m and 20 m) behind one tag: one line each, with its status.
  const title = await tag.getAttribute("title");
  expect(title?.split("\n")).toHaveLength(2);
  for (const line of title!.split("\n"))
    expect(line).toMatch(/ — (Acquired|Remote|Missing|Untracked|Incomplete)$/);
});

test("repeated milestone ids are explained by the roadmap name", async ({ page }) => {
  await page.goto("/");
  const illumination = page.getByTestId("readiness-illumination");
  const visibility = page.getByTestId("readiness-visibility");
  await expect(illumination).toHaveText("M04 · available");
  await expect(visibility).toHaveText("M04 · available");
  await expect(illumination).toHaveAttribute("title", /Milestone M04: Illumination and Earth visibility/);
  await expect(page.getByTestId("readiness-analysis")).toHaveAttribute(
    "title",
    /Milestone M05: Mission intelligence/,
  );
});
