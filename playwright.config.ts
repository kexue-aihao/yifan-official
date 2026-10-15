import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  globalTeardown: "./tests/browser/cleanup.mjs",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 30000,
  use: {
    locale: "zh-CN",
    baseURL: "http://127.0.0.1:4174",
    browserName: "chromium",
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/ui-server.mjs",
    url: "http://127.0.0.1:4174/api/health",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
