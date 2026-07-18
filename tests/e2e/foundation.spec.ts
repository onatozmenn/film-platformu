import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const serverOnlySentinel = "server-only-sentinel-do-not-ship";

test("renders the responsive Turkish foundation shell without leaks", async ({ page }) => {
  const browserErrors: string[] = [];
  const runtimeGoogleFontRequests: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(message.text());
    }
  });
  page.on("request", (request) => {
    if (/fonts\.(?:googleapis|gstatic)\.com/u.test(request.url())) {
      runtimeGoogleFontRequests.push(request.url());
    }
  });

  const response = await page.goto("/");

  expect(response).not.toBeNull();
  expect(response?.headers()["x-request-id"]).toMatch(/^req_[a-f0-9]{32}$/u);
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  await expect(page.locator("html")).toHaveAttribute("lang", "tr");
  await expect(page.getByRole("heading", { level: 1, name: "Film Platform" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ana içeriğe geç" })).toBeAttached();

  await page.evaluate(() => document.fonts.ready);
  const typography = await page.evaluate(() => {
    const heading = document.querySelector("h1");

    return {
      body: getComputedStyle(document.body).fontFamily,
      heading: heading === null ? "" : getComputedStyle(heading).fontFamily,
      status: document.fonts.status,
    };
  });
  expect(typography.body).toContain("DM Sans");
  expect(typography.heading).toContain("Source Serif 4");
  expect(typography.status).toBe("loaded");

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);

  const accessibility = await new AxeBuilder({ page }).analyze();
  const seriousViolations = accessibility.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
  expect(seriousViolations).toEqual([]);

  const scriptSources = await page.locator("script[src]").evaluateAll((scripts) =>
    scripts.map((script) => {
      const source = script.getAttribute("src");
      return source === null ? "" : new URL(source, document.baseURI).href;
    }),
  );
  const publicBodies = [await response?.text()];
  for (const source of scriptSources.filter(Boolean)) {
    const scriptResponse = await page.request.get(source);
    publicBodies.push(await scriptResponse.text());
  }

  expect(publicBodies.join("\n")).not.toContain(serverOnlySentinel);
  expect(runtimeGoogleFontRequests).toEqual([]);
  expect(browserErrors).toEqual([]);
  await expect(page).toHaveScreenshot("foundation-shell.png", {
    fullPage: true,
  });
});

test("health endpoints expose only coarse state", async ({ request }) => {
  const live = await request.get("/api/health/live");
  const ready = await request.get("/api/health/ready");

  expect(live.status()).toBe(200);
  expect(await live.json()).toEqual({ status: "ok" });
  expect(ready.status()).toBe(200);
  expect(await ready.json()).toEqual({ status: "ok" });
  expect(live.headers()["cache-control"]).toBe("no-store");
  expect(ready.headers()["cache-control"]).toBe("no-store");
  expect(live.headers()["x-request-id"]).toMatch(/^req_[a-f0-9]{32}$/u);
  expect(ready.headers()["x-request-id"]).toMatch(/^req_[a-f0-9]{32}$/u);
});

test("unknown routes render the safe Turkish not-found state", async ({ page }) => {
  const response = await page.goto("/programda-olmayan-bir-sayfa");

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { level: 1, name: "Bu sayfa programda yok" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Ana sayfaya dön" })).toHaveAttribute("href", "/");
});
