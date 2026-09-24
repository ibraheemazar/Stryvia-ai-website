import { defineConfig, devices } from "@playwright/test";

// E2E for the Idea Lab money path (TESTING.md §5). Runs against a dev server
// with the mock AI provider and the log mail sink; needs a Supabase project
// (E2E_BASE_URL may point at a preview deployment instead).
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3100";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "en-US",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: undefined } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npx next dev -p 3100",
        url: "http://localhost:3100/api/health",
        reuseExistingServer: true,
        timeout: 180_000,
        env: {
          LAB_AI_PROVIDER: "mock",
          LAB_MAIL_PROVIDER: "log",
          LAB_TURNSTILE_DISABLED: "true",
          LAB_COOKIE_SECRET: process.env.LAB_COOKIE_SECRET || "e2e-cookie-secret",
        },
      },
});
