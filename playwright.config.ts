import { defineConfig, devices } from "@playwright/test";

/**
 * Browser-level production-build smoke suite (task-0007 acceptance criterion 3-4).
 *
 * The focused homepage command serves the prerendered production HTML and its assets
 * directly from Playwright routing, so it does not need a persistent server. The broader
 * catalog/market suite continues to exercise a production Next server.
 *
 * Two viewport "narrow"/"wide" projects satisfy the AC's two viewport classes. No retries:
 * a flaky pass must not be mistaken for a genuine one, and this suite must never mask
 * cross-version contract drift by quietly re-running.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL:
      process.env.E2E_BASE_URL ??
      (process.env.E2E_STATIC_BUILD === "1"
        ? "http://homepage.e2e.local"
        : "http://localhost:3000"),
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "narrow",
      // iPhone 13 viewport/UA/touch on Chromium rather than the "iPhone 13" device
      // preset's default WebKit engine: WebKit requires system libraries this
      // execution environment (and a plain CI runner without extra apt packages)
      // doesn't have, while Chromium mobile emulation exercises the same narrow
      // width, touch, and responsive-breakpoint behavior deterministically.
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
    {
      name: "wide",
      use: { viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: process.env.E2E_BASE_URL || process.env.E2E_STATIC_BUILD === "1"
    ? undefined
    : {
        // Serves whichever production build is currently on disk under .next — the
        // e2e:build:v2 / e2e:build:legacy scripts produce that build before this runs.
        command: "npm run start",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
