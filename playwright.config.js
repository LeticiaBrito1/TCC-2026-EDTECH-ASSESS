import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],

  use: {
    baseURL: "https://edtech-assess.duckdns.org",
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
