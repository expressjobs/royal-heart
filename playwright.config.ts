import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8080";

export default defineConfig({
  testDir: "./tests/e2e",
  // Use a `.pw.ts` suffix so these browser tests are never picked up by Vitest,
  // which claims `*.spec.ts` / `*.test.ts` by default.
  testMatch: "**/*.pw.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    launchOptions: {
      // In sandboxed CI, point at a preinstalled Chromium via PW_CHROMIUM_PATH.
      // Locally this is undefined and Playwright uses its bundled browser.
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: `${BASE_URL}/auth`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
