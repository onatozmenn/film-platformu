import { defineConfig } from "@playwright/test";

const port = 3100;
const baseURL = `http://127.0.0.1:${port}`;
const localDatabaseUrl = "postgresql://film:film@127.0.0.1:54329/film_platform?schema=public";

export default defineConfig({
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.025,
    },
  },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  outputDir: "test-results",
  projects: [
    {
      name: "chromium-mobile",
      use: {
        browserName: "chromium",
        viewport: { height: 800, width: 360 },
      },
    },
    {
      name: "chromium-desktop",
      use: {
        browserName: "chromium",
        viewport: { height: 900, width: 1440 },
      },
    },
  ],
  reporter: [["line"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  retries: process.env.CI ? 1 : 0,
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}{ext}",
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL,
    colorScheme: "dark",
    locale: "tr-TR",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `corepack pnpm dev --hostname 127.0.0.1 --port ${port}`,
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? localDatabaseUrl,
      LOG_LEVEL: "warn",
      NEXT_PUBLIC_SITE_NAME: "Film Platform",
      SERVER_ONLY_TEST_SENTINEL: "server-only-sentinel-do-not-ship",
      TRUST_INCOMING_REQUEST_ID: "false",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: baseURL,
  },
  workers: process.env.CI ? 1 : 2,
});
