import { expect, test, type Page, type TestInfo } from "@playwright/test";

/**
 * T-31: south-pole terrain scene (D5) from the C3 export.
 *
 * Most tests serve a SYNTHETIC scene by route interception (a smooth bump field on the
 * 1 737 400 m sphere, with a block of NaN vertices) so they are deterministic whether or
 * not this checkout has acquired LOLA LDEM_75S_240M. It is labelled synthetic in its
 * metadata and is never lunar data. One test runs against the live API in whatever
 * state it is (scene served, or DEM not acquired → labelled error).
 */

declare global {
  interface Window {
    __lunarisTerrainFrames?: number[];
    __lunarisTerrainBench?: boolean;
  }
}

const R = 1_737_400;
const API = /\/api\/v1\/terrain\/scenes\/south-pole(\?.*)?$/;
const DATA = /\/api\/v1\/terrain\/scenes\/south-pole\/data(\?.*)?$/;

interface Synthetic {
  metadata: Record<string, unknown>;
  body: Buffer;
  nanCount: number;
}

/** SYNTHETIC C3 scene: rows → −X (180° E), columns → +Y (90° E), relative to (0, 0, −R). */
function syntheticScene(size: number, nanBlock = 0): Synthetic {
  const half = 125_000;
  const spacing = (2 * half) / (size - 1);
  const values = new Float32Array(size * size * 4);
  let nanCount = 0;
  let hMin = Infinity;
  let hMax = -Infinity;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const i = r * size + c;
      if (r < nanBlock && c < nanBlock) {
        values.set([NaN, NaN, NaN, NaN], i * 4);
        nanCount++;
        continue;
      }
      const x = half - r * spacing;
      const y = -half + c * spacing;
      const h = 3000 * Math.sin(x / 20_000) * Math.cos(y / 15_000);
      hMin = Math.min(hMin, h);
      hMax = Math.max(hMax, h);
      const k = (R + h) / Math.hypot(x, y, R);
      values.set([x * k, y * k, -R * k + R, h], i * 4);
    }
  }
  const dataUrl = `/api/v1/terrain/scenes/south-pole/data?grid_size=${size}`;
  return {
    nanCount,
    body: Buffer.from(values.buffer),
    metadata: {
      scene_id: "south-pole",
      title: "SYNTHETIC E2E FIXTURE — not lunar data",
      frame: "MOON_ME",
      width: size,
      height: size,
      origin_moon_me_m: [0, 0, -R],
      height_reference_radius_m: R,
      height_min_m: hMin,
      height_max_m: hMax,
      vertex_spacing_m: spacing,
      half_extent_m: half,
      center_latitude_deg: -90,
      center_longitude_deg: 0,
      resampling: "synthetic",
      method: "SYNTHETIC test fixture",
      nodata: "NaN vertices must not be drawn.",
      nodata_vertex_count: nanCount,
      layout: {
        dtype: "float32",
        byte_order: "little",
        order: "row-major",
        values_per_vertex: 4,
        components: ["x_m", "y_m", "z_m", "height_m"],
        row_direction: "row 0 toward 0° E",
        byte_length: size * size * 16,
      },
      dem: {
        dataset_id: "synthetic-e2e",
        title: "SYNTHETIC E2E FIXTURE — not lunar data",
        file_name: "synthetic-e2e.img",
        sha256: "0".repeat(63) + "2",
        source_url: "https://pds-geosciences.wustl.edu/",
        resolution_m: spacing,
        frame: "MOON_ME",
        citation: "Synthetic test fixture.",
      },
      evidence: {
        kind: "derived_product",
        statement: "SYNTHETIC test fixture.",
        sources: [],
        method: "synthetic",
        assumptions: ["Synthetic assumption line."],
      },
      etag: '"synthetic"',
      data_url: dataUrl,
    },
  };
}

async function serve(page: Page, scene: Synthetic) {
  await page.route(API, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(scene.metadata) }),
  );
  await page.route(DATA, (route) =>
    route.fulfill({ status: 200, contentType: "application/octet-stream", body: scene.body }),
  );
}

async function enterTerrain(page: Page, query = "") {
  await page.goto(`/${query}`);
  await expect(page.getByTestId("moon-canvas").locator("canvas")).toBeVisible();
  await page.getByRole("radio", { name: "South-pole terrain" }).click();
}

test("globe → pole: descends, shows the mesh with provenance, skips NaN vertices, and returns", async ({
  page,
}) => {
  const scene = syntheticScene(64, 8);
  await serve(page, scene);
  await enterTerrain(page, "?terrain_grid=64");

  const view = page.getByTestId("terrain-view");
  await expect(view).toHaveAttribute("data-terrain-state", "ready", { timeout: 60_000 });
  await expect(view).toHaveAttribute("data-settled", "true", { timeout: 60_000 });
  await expect(page.getByTestId("terrain-canvas").locator("canvas")).toBeVisible();

  // 8×8 NaN corner block: 64 vertices never drawn; every quad touching it loses triangles.
  await expect(view).toHaveAttribute("data-skipped-vertices", "64");
  await expect(view).toHaveAttribute("data-valid-vertices", String(64 * 64 - 64));
  const triangles = Number(await view.getAttribute("data-triangles"));
  expect(triangles).toBeLessThan(63 * 63 * 2);
  expect(triangles).toBeGreaterThan(63 * 63 * 2 - 9 * 9 * 2);

  await expect(page.getByTestId("terrain-lighting-disclosure")).toContainText("not the computed Sun");
  await page.getByTestId("terrain-provenance-trigger").click();
  const panel = page.getByTestId("terrain-provenance");
  await expect(panel).toContainText("SYNTHETIC E2E FIXTURE");
  await expect(page.getByTestId("terrain-provenance-sha256")).toHaveText("0".repeat(63) + "2");
  await expect(page.getByTestId("terrain-provenance-nodata")).toContainText(
    "64 of 4096 vertices; 64 skipped",
  );
  await page.keyboard.press("Escape");

  await page.getByRole("radio", { name: "Globe" }).click();
  await expect(page.getByTestId("moon-canvas").locator("canvas")).toBeVisible();
  await expect(page.getByTestId("terrain-view")).toHaveCount(0);
});

test("a registered site inside the scene gets a pin and a label", async ({ page, request }) => {
  const api = "http://localhost:8100";
  const name = `E2E terrain site ${Date.now()}`;
  const created = await request.post(`${api}/api/v1/sites`, {
    data: { name, latitude_deg: -89.5, longitude_deg: 45, notes: "e2e test site" },
  });
  expect(created.ok()).toBe(true);
  const { id } = (await created.json()) as { id: string };
  try {
    await serve(page, syntheticScene(128));
    await enterTerrain(page, "?terrain_grid=128");
    await expect(page.getByTestId("terrain-view")).toHaveAttribute("data-settled", "true", {
      timeout: 60_000,
    });
    await expect(page.getByTestId("terrain-site-count")).toContainText("1 site on the terrain");
    await expect(page.getByText(name, { exact: true }).last()).toHaveCSS("opacity", "1");
  } finally {
    await request.delete(`${api}/api/v1/sites/${id}`);
  }
});

test("terrain errors are shown, not drawn as flat ground", async ({ page }) => {
  await page.route(API, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "dataset_unavailable",
          message: "Dataset 'lola-ldem-75s-240m' is missing; acquire it with uv run lunaris-data acquire.",
          details: [],
          request_id: "e2e",
        },
      }),
    }),
  );
  await enterTerrain(page);
  const view = page.getByTestId("terrain-view");
  await expect(view).toHaveAttribute("data-terrain-state", "error", { timeout: 60_000 });
  await expect(view).toContainText("Terrain unavailable");
  await expect(view).toContainText("acquire it with");
  await expect(page.getByTestId("terrain-canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "Back to globe" }).click();
  await expect(page.getByTestId("moon-canvas").locator("canvas")).toBeVisible();
});

test("live API: the real scene renders, or its absence is labelled", async ({ page, request }) => {
  const list = await request.get("http://localhost:8100/api/v1/terrain/scenes");
  expect(list.ok()).toBe(true);
  const { scenes } = (await list.json()) as { scenes: { scene_id: string; available: boolean }[] };
  const available = scenes.find((s) => s.scene_id === "south-pole")?.available ?? false;
  // Small grid: the CI browser rasterises in software (see the frame-time test).
  await enterTerrain(page, "?terrain_grid=128");
  const view = page.getByTestId("terrain-view");
  if (available) {
    await expect(view).toHaveAttribute("data-terrain-state", "ready", { timeout: 60_000 });
    await page.getByTestId("terrain-provenance-trigger").click();
    await expect(page.getByTestId("terrain-provenance")).toContainText("LDEM_75S_240M");
  } else {
    await expect(view).toHaveAttribute("data-terrain-state", "error", { timeout: 60_000 });
    await expect(view).toContainText("Terrain unavailable");
  }
});

test.describe("phone width", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("works at 390 px: 512² default grid, no horizontal scroll", async ({ page }) => {
    // Serve a 512² synthetic scene for the default phone grid.
    await serve(page, syntheticScene(512));
    await enterTerrain(page);
    const view = page.getByTestId("terrain-view");
    await expect(view).toHaveAttribute("data-grid-size", "512");
    await expect(view).toHaveAttribute("data-settled", "true", { timeout: 120_000 });
    const widths = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(widths[0]).toBe(widths[1]);
    await expect(page.getByTestId("terrain-provenance-trigger")).toBeVisible();
  });
});

async function measureFrames(page: Page, testInfo: TestInfo, label: string, seconds: number) {
  await page.evaluate(() => {
    window.__lunarisTerrainFrames = [];
    window.__lunarisTerrainBench = true;
  });
  await page.waitForTimeout(seconds * 1000);
  const frames = await page.evaluate(() => {
    window.__lunarisTerrainBench = false;
    return (window.__lunarisTerrainFrames ?? []).slice(1);
  });
  expect(frames.length, `${label}: frames rendered`).toBeGreaterThan(1);
  const sorted = [...frames].sort((a, b) => a - b);
  const pick = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
  const result = `${label}: ${frames.length} frames, median ${pick(0.5).toFixed(1)} ms, p95 ${pick(0.95).toFixed(1)} ms`;
  testInfo.annotations.push({ type: "frame-time", description: result });
  console.log(`[frame-time] ${result}`);
}

test("frame time on this browser (SYNTHETIC scenes at the shipped grid sizes)", async ({
  page,
}, testInfo) => {
  test.setTimeout(300_000);
  const renderer = await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    return ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "unknown";
  });
  testInfo.annotations.push({ type: "renderer", description: renderer });
  console.log(`[frame-time] renderer: ${renderer}`);
  for (const size of [1024, 512]) {
    await page.unrouteAll({ behavior: "wait" });
    await serve(page, syntheticScene(size));
    await enterTerrain(page, `?terrain_grid=${size}`);
    await expect(page.getByTestId("terrain-view")).toHaveAttribute("data-settled", "true", {
      timeout: 180_000,
    });
    await measureFrames(page, testInfo, `${size}² grid, 1600×960`, size === 1024 ? 12 : 8);
  }
});

/** SYNTHETIC ephemeris (labelled): the Sun circles the horizon at 1–2° elevation. */
function syntheticSunEphemeris(url: string) {
  const q = new URL(url).searchParams;
  const start = Date.parse(q.get("start_utc")!);
  const end = Date.parse(q.get("end_utc")!);
  const step = Number(q.get("step_s")) * 1000;
  const n = Math.floor((end - start) / step) + 1;
  const body = (name: "sun" | "earth", period: number, elev: (t: number) => number) => ({
    body: name,
    body_radius_m: 1,
    body_radii_m: [1, 1, 1],
    evidence: {
      kind: "model",
      statement: "SYNTHETIC E2E FIXTURE — not lunar geometry.",
      sources: [],
      method: "synthetic",
      assumptions: [],
    },
    samples: Array.from({ length: n }, (_, i) => {
      const t = i * step;
      const az = ((360 * t) / period) % 360;
      const el = elev(t);
      const a = (az * Math.PI) / 180;
      const e = (el * Math.PI) / 180;
      // Local frame at the pole: north = +X (0° E), east = +Y, up = −Z.
      return {
        epoch_utc: new Date(start + t).toISOString(),
        azimuth_deg: az,
        elevation_deg: el,
        range_m: 1,
        angular_radius_deg: 0.27,
        direction_moon_me: [Math.cos(e) * Math.cos(a), Math.cos(e) * Math.sin(a), -Math.sin(e)],
      };
    }),
  });
  return {
    site_id: "synthetic",
    site_name: "synthetic",
    frame: "MOON_ME",
    aberration_correction: "CN+S",
    start_utc: q.get("start_utc"),
    end_utc: q.get("end_utc"),
    step_s: Number(q.get("step_s")),
    sample_count: n,
    max_samples: 10_000,
    observer: {},
    limitations: [],
    bodies: [
      body("sun", 29.5 * 86_400_000, (t) => 1.5 + 0.5 * Math.sin(t / 86_400_000)),
      body("earth", 27.3 * 86_400_000, (t) => 5 * Math.sin(t / 3e8)),
    ],
  };
}

test("T-33: the SPICE Sun lights the terrain at the epoch; shadows labelled illustrative", async ({
  page,
  request,
}) => {
  const api = "http://localhost:8100";
  const name = `E2E lit site ${Date.now()}`;
  const created = await request.post(`${api}/api/v1/sites`, {
    data: { name, latitude_deg: -89.5, longitude_deg: 45, notes: "e2e lighting" },
  });
  const { id } = (await created.json()) as { id: string };
  try {
    await serve(page, syntheticScene(128));
    await page.route(/\/api\/v1\/sites\/[^/]+\/ephemeris\?/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(syntheticSunEphemeris(route.request().url())),
      }),
    );
    await page.route(/\/api\/v1\/analysis\/timeline$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(syntheticTimeline(route.request().postDataJSON() as TimelineRequest, null)),
      }),
    );
    await page.goto("/?terrain_grid=128");
    await expect(page.getByTestId("moon-canvas").locator("canvas")).toBeVisible();

    // No site selected: display light, labelled.
    await page.getByRole("radio", { name: "South-pole terrain" }).click();
    const view = page.getByTestId("terrain-view");
    await expect(view).toHaveAttribute("data-settled", "true", { timeout: 60_000 });
    await expect(view).toHaveAttribute("data-lighting", "display");
    await expect(page.getByTestId("terrain-lighting-disclosure")).toContainText("Select a site");

    // Select the site: SPICE Sun at the epoch.
    await page
      .getByTestId("site-list")
      .locator("li", { hasText: name })
      .locator("button[aria-pressed]")
      .click();
    await expect(view).toHaveAttribute("data-lighting", "spice");
    const disclosure = page.getByTestId("terrain-lighting-disclosure");
    await expect(disclosure).toContainText("Rendered shadows are illustrative");
    const illumination = page.getByTestId("terrain-site-illumination");
    await expect(illumination).toHaveAttribute("data-state", "computed");
    await expect(illumination).toContainText("terrain horizon not available");
    await expect(illumination).toContainText("(astronomical)");
    await expect(illumination).toContainText("Window (astronomical horizon)");
    await expect(page.getByTestId("selected-site-sun-azel")).toHaveText(/^\d+\.\d° \/ [+−]\d+\.\d{2}°$/);

    // Scrubbing the epoch moves the Sun.
    const before = await page.getByTestId("terrain-sun-elevation").textContent();
    const azBefore = await page.getByTestId("selected-site-sun-azel").textContent();
    await page.getByTestId("timeline-track").focus();
    for (let i = 0; i < 2; i++) await page.keyboard.press("PageUp");
    await expect(page.getByTestId("selected-site-sun-azel")).not.toHaveText(azBefore!);
    await expect(page.getByTestId("terrain-sun-elevation")).not.toHaveText(before!);
  } finally {
    await request.delete(`${api}/api/v1/sites/${id}`);
  }
});

interface TimelineRequest {
  site_id: string;
  start_utc: string;
  end_utc: string;
  step_s: number;
}

/** SYNTHETIC C4 timeline (labelled). `terrain` null = no horizon mask served. */
function syntheticTimeline(req: TimelineRequest, terrain: number | null) {
  const start = Date.parse(req.start_utc);
  const step = req.step_s * 1000;
  const n = Math.floor((Date.parse(req.end_utc) - start) / step) + 1;
  const summary = (mean: number, truncated: boolean) => ({
    horizon: "x",
    mean_visible_disk_fraction: mean,
    illuminated_fraction: mean,
    fully_lit_fraction: mean,
    longest_darkness_s: 0,
    longest_darkness_censored: false,
    longest_illumination_s: 0,
    longest_illumination_censored: true,
    any_truncated: truncated,
    resolution_s: req.step_s,
    sunlit_windows: [],
  });
  return {
    site_id: req.site_id,
    site_name: "synthetic",
    start_utc: req.start_utc,
    end_utc: req.end_utc,
    step_s: req.step_s,
    sample_count: n,
    max_samples: 10_000,
    computed_at_utc: req.start_utc,
    observer: {},
    software: {},
    terrain_horizon_available: terrain !== null,
    illumination: {
      body: "sun",
      evidence: {
        kind: "calculation",
        statement: "SYNTHETIC E2E FIXTURE.",
        sources: [],
        method: "x",
        assumptions: [],
      },
      limitations: [],
      astronomical: summary(1, false),
      terrain: terrain === null ? null : summary(terrain, true),
      samples: Array.from({ length: n }, (_, i) => ({
        epoch_utc: new Date(start + i * step).toISOString(),
        azimuth_deg: 0,
        elevation_deg: 1.5,
        solar_radius_deg: 0.27,
        astronomical_visible_fraction: 1,
        terrain_horizon_elevation_deg: terrain === null ? null : 1,
        terrain_visible_fraction: terrain,
        terrain_truncated: terrain === null ? null : true,
      })),
    },
    // Contract-shaped Earth result (C4): evidence with a kind, samples with fractions and LOS state.
    earth_visibility: {
      body: "earth",
      evidence: {
        kind: "calculation",
        statement: "SYNTHETIC E2E FIXTURE.",
        sources: [],
        method: "x",
        assumptions: [],
      },
      limitations: ["Geometric visibility does not imply a radio link."],
      astronomical: summary(1, false),
      terrain: null,
      samples: Array.from({ length: n }, (_, i) => ({
        epoch_utc: new Date(start + i * step).toISOString(),
        azimuth_deg: 0,
        elevation_deg: 5,
        earth_radius_deg: 0.95,
        astronomical_visible_fraction: 1,
        terrain_horizon_elevation_deg: null,
        terrain_visible_fraction: null,
        terrain_truncated: null,
        line_of_sight: "clear",
      })),
    },
  };
}

test("T-33: a served terrain fraction is shown, truncated values as an upper bound", async ({
  page,
  request,
}) => {
  const api = "http://localhost:8100";
  const name = `E2E masked site ${Date.now()}`;
  const created = await request.post(`${api}/api/v1/sites`, {
    data: { name, latitude_deg: -89.5, longitude_deg: 45, notes: "e2e lighting" },
  });
  const { id } = (await created.json()) as { id: string };
  try {
    await serve(page, syntheticScene(64));
    await page.route(/\/api\/v1\/sites\/[^/]+\/ephemeris\?/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(syntheticSunEphemeris(route.request().url())),
      }),
    );
    await page.route(/\/api\/v1\/analysis\/timeline$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(syntheticTimeline(route.request().postDataJSON() as TimelineRequest, 0.42)),
      }),
    );
    await page.goto("/?terrain_grid=64");
    await page
      .getByTestId("site-list")
      .locator("li", { hasText: name })
      .locator("button[aria-pressed]")
      .click();
    await page.getByRole("radio", { name: "South-pole terrain" }).click();
    await expect(page.getByTestId("terrain-view")).toHaveAttribute("data-lighting", "spice", {
      timeout: 60_000,
    });
    await expect(page.getByTestId("terrain-site-illumination-terrain")).toHaveText(
      "≤ 42 % (terrain horizon)",
    );
    await expect(page.getByTestId("terrain-site-illumination")).toContainText("Window (terrain horizon)");
  } finally {
    await request.delete(`${api}/api/v1/sites/${id}`);
  }
});
