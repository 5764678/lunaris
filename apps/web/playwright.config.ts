/**
 * End-to-end tests: real API (uvicorn) + real web client (Next.js) + real browser.
 * Specs live in tests/integration/e2e/. Run from the repo root with `npm run test:e2e`.
 *
 * Dedicated ports (API 8100, web 3100) and a throw-away data directory keep the suite
 * independent of any development servers and of the local SQLite database.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { defineConfig, devices } from "@playwright/test";

const API_PORT = 8100;
const WEB_PORT = 3100;
const repoRoot = join(__dirname, "../..");
const dataDir = process.env.LUNARIS_E2E_DATA_DIR ?? mkdtempSync(join(tmpdir(), "lunaris-e2e-"));

export default defineConfig({
  testDir: join(repoRoot, "tests/integration/e2e"),
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    viewport: { width: 1600, height: 960 },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1600, height: 960 },
        // Software WebGL for headless CI runners without a GPU.
        launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
      },
    },
  ],
  webServer: [
    {
      command: `uv run uvicorn lunaris_api.main:app --host 127.0.0.1 --port ${API_PORT}`,
      cwd: repoRoot,
      url: `http://127.0.0.1:${API_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        LUNARIS_ENVIRONMENT: "test",
        LUNARIS_DATA_DIR: dataDir,
        LUNARIS_CORS_ORIGINS: `http://localhost:${WEB_PORT},http://127.0.0.1:${WEB_PORT}`,
        LUNARIS_LOG_LEVEL: "WARNING",
      },
    },
    {
      command: `npx next dev -p ${WEB_PORT}`,
      cwd: __dirname,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: { NEXT_PUBLIC_LUNARIS_API_URL: `http://localhost:${API_PORT}`, NEXT_TELEMETRY_DISABLED: "1" },
    },
  ],
});
