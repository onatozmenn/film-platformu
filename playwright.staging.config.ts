import { defineConfig } from "@playwright/test";

import { parseStagingOrigin, parseStagingReleaseId } from "./src/shared/config/staging-origin";

const baseURL = parseStagingOrigin(process.env.STAGING_ORIGIN);
parseStagingReleaseId(process.env.STAGING_EXPECTED_RELEASE_ID);

export default defineConfig({
  expect: { timeout: 15_000 },
  forbidOnly: true,
  fullyParallel: false,
  outputDir: "test-results-staging",
  projects: [
    {
      name: "staging-mobile",
      use: { browserName: "chromium", viewport: { height: 800, width: 360 } },
    },
    {
      name: "staging-desktop",
      use: { browserName: "chromium", viewport: { height: 900, width: 1440 } },
    },
  ],
  reporter: [["line"], ["html", { open: "never", outputFolder: "playwright-report-staging" }]],
  retries: 1,
  testDir: "./tests/staging",
  timeout: 60_000,
  use: {
    baseURL,
    colorScheme: "dark",
    locale: "tr-TR",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  workers: 1,
});
