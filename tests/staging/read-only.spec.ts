import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { parseStagingReleaseId } from "@/shared/config/staging-origin";

const expectedReleaseId = parseStagingReleaseId(process.env.STAGING_EXPECTED_RELEASE_ID);

async function expectAccessible(page: Page): Promise<void> {
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    ),
  ).toEqual([]);
}

test("public discovery and one licensed watch route are healthy", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.name));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push("console.error");
  });

  const homeResponse = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(homeResponse?.status()).toBe(200);
  expect(homeResponse?.headers()["x-release-id"]).toBe(expectedReleaseId);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const headers = homeResponse?.headers() ?? {};
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(
    headers["content-security-policy"] ?? headers["content-security-policy-report-only"],
  ).toContain("frame-ancestors 'none'");
  await expectAccessible(page);

  const catalogResponse = await page.goto("/filmler", { waitUntil: "domcontentloaded" });
  expect(catalogResponse?.status()).toBe(200);
  const detailHref = await page.locator('a[href^="/film/"]').first().getAttribute("href");
  expect(detailHref).toMatch(/^\/film\/[a-z0-9-]+$/u);
  const detailResponse = await page.goto(detailHref ?? "/filmler", {
    waitUntil: "domcontentloaded",
  });
  expect(detailResponse?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const watchHref = await page.getByRole("link", { name: "İzle" }).getAttribute("href");
  expect(watchHref).toMatch(/^\/izle\/[a-z0-9-]+$/u);
  const watchResponse = await page.goto(watchHref ?? "/filmler", {
    waitUntil: "domcontentloaded",
  });
  expect(watchResponse?.status()).toBe(200);
  await expect(page.locator("mux-player")).toBeVisible();
  await expectAccessible(page);
  expect(browserErrors).toEqual([]);
});

test("health, crawler policy, and private boundaries are available", async ({ request }) => {
  const live = await request.get("/api/health/live");
  expect(live.status()).toBe(200);
  expect(live.headers()["x-release-id"]).toBe(expectedReleaseId);
  const ready = await request.get("/api/health/ready");
  expect(ready.status()).toBe(200);
  expect(ready.headers()["x-release-id"]).toBe(expectedReleaseId);
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  await expect(robots.text()).resolves.toContain("Disallow: /yonetim/");
  expect((await request.get("/api/internal/publish-due")).status()).toBe(401);
  expect((await request.get("/api/internal/run-retention")).status()).toBe(401);
  expect([302, 303, 307, 308, 404]).toContain(
    (await request.get("/yonetim", { maxRedirects: 0 })).status(),
  );
});
