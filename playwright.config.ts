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
    // Containers that ship their own Chromium (no `playwright install`) point
    // PLAYWRIGHT_CHROMIUM_PATH at the binary; everywhere else the bundled one is used.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : undefined,
    // Sandboxed CI/agent containers that route HTTPS through an intercepting
    // proxy set this so the browser can reach Supabase storage; never needed
    // on a normal machine.
    ignoreHTTPSErrors: process.env.PLAYWRIGHT_IGNORE_HTTPS_ERRORS === "1",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: undefined } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
    // Chromium phone emulation (Android). Used where WebKit is not installed.
    { name: "mobile-android", use: { ...devices["Pixel 7"] } },
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
