import { expect, test } from "@playwright/test";

/**
 * T-37: the globe is lit by the SPICE Sun at the timeline epoch. A SYNTHETIC Sun series
 * (labelled; not lunar geometry) is served by route interception: the sub-solar point
 * moves 12.2° per day in longitude, as the real one does.
 */

const SUN = /\/api\/v1\/ephemeris\/sun\?/;

function syntheticSun(url: string) {
  const q = new URL(url).searchParams;
  const start = Date.parse(q.get("start_utc")!);
  const step = Number(q.get("step_s")) * 1000;
  const n = Math.floor((Date.parse(q.get("end_utc")!) - start) / step) + 1;
  return {
    start_utc: q.get("start_utc"),
    end_utc: q.get("end_utc"),
    step_s: Number(q.get("step_s")),
    sample_count: n,
    max_samples: 10_000,
    frame: "MOON_ME",
    origin: "MOON",
    aberration_correction: "CN+S",
    sun_radius_m: 695_700_000,
    evidence: {
      kind: "model",
      statement: "SYNTHETIC E2E FIXTURE.",
      sources: [],
      method: "x",
      assumptions: [],
    },
    limitations: [],
    samples: Array.from({ length: n }, (_, i) => {
      const lon = (((i * step) / 86_400_000) * 12.2) % 360;
      const r = (lon * Math.PI) / 180;
      return {
        epoch_utc: new Date(start + i * step).toISOString(),
        direction_moon_me: [Math.cos(r), Math.sin(r), 0],
        subsolar_latitude_deg: 0,
        subsolar_longitude_deg: lon,
        range_m: 1.5e11,
        angular_radius_deg: 0.27,
      };
    }),
  };
}

test("SPICE Sun lights the globe; the sub-solar point moves with the timeline", async ({ page }) => {
  await page.route(SUN, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(syntheticSun(route.request().url())),
    }),
  );
  await page.goto("/");
  const disclosure = page.getByTestId("lighting-disclosure");
  await expect(disclosure).toHaveAttribute("data-lighting", "spice");
  await expect(disclosure).toContainText("Sun position · NASA SPICE");
  await expect(disclosure).toContainText("No earthshine modelled: the night side is shown dark, not black");
  await expect(disclosure).not.toContainText("View-relative");
  await expect(page.getByTestId("subsolar-point")).toHaveText("0.00°N 0.00°E");

  await page.getByTestId("timeline-track").focus();
  await page.keyboard.press("PageUp"); // +1 day
  await expect(page.getByTestId("subsolar-point")).toHaveText("0.00°N 12.20°E");
});

test("without the Sun series the globe keeps the labelled display light and says why", async ({ page }) => {
  await page.route(SUN, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "kernels_unavailable",
          message: "SPICE kernels not acquired.",
          details: [],
          request_id: "e2e",
        },
      }),
    }),
  );
  await page.goto("/");
  const disclosure = page.getByTestId("lighting-disclosure");
  await expect(disclosure).toHaveAttribute("data-lighting", "display");
  await expect(disclosure).toContainText("not the computed Sun direction");
  await expect(disclosure).toContainText("SPICE kernels not acquired");
});
