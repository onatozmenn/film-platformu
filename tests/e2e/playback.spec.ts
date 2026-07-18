import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { z } from "zod";

const playbackResponseSchema = z.object({
  data: z.object({ playback: z.object({ token: z.string().min(1) }) }),
});
const muxServerOnlySentinel = "mux-server-only-sentinel-do-not-ship";

function requirePublicJourneyViewport(projectName: string): void {
  test.skip(
    projectName !== "chromium-mobile" && projectName !== "chromium-desktop",
    "Critical public playback journeys run at mobile and desktop viewports.",
  );
}

async function expectAccessible(page: Page): Promise<void> {
  await expect(page).toHaveTitle(/\S/u);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    ),
  ).toEqual([]);
}

test("eligible guest receives a private grant and renders owned fake video", async ({
  page,
}, testInfo) => {
  requirePublicJourneyViewport(testInfo.project.name);
  await page.goto("/film/kiyidaki-sessizlik");
  const sessionResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/playback/sessions") &&
      response.request().method() === "POST",
  );
  const fixtureResponsePromise = page.waitForResponse((candidate) =>
    candidate.url().includes("/fixtures/playback/guest-feature.mp4"),
  );

  await page.getByRole("link", { name: "İzle" }).click();
  await expect(page).toHaveURL(/\/izle\/kiyidaki-sessizlik$/u);
  await expect(page.getByRole("heading", { level: 1, name: "Kıyıdaki Sessizlik" })).toBeVisible();

  const response = await sessionResponse;
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  const payload = playbackResponseSchema.parse((await response.json()) as unknown);
  const token = payload.data.playback.token;
  const player = page.locator("mux-player");
  await expect(player).toBeVisible();

  const fixtureResponse = await fixtureResponsePromise;
  expect([200, 206]).toContain(fixtureResponse.status());
  await expect
    .poll(() => player.evaluate((element) => Reflect.get(element, "readyState")))
    .toBeGreaterThanOrEqual(1);
  await expect
    .poll(() =>
      player.evaluate((element) => {
        const tracks = Reflect.get(element, "textTracks");
        return tracks instanceof TextTrackList ? tracks.length : 0;
      }),
    )
    .toBeGreaterThanOrEqual(1);

  const started = await player.evaluate(async (element) => {
    Reflect.set(element, "muted", true);
    const play = Reflect.get(element, "play");
    if (typeof play !== "function") {
      return false;
    }
    await play.call(element);
    return true;
  });
  expect(started).toBe(true);
  await expect
    .poll(() => player.evaluate((element) => Reflect.get(element, "currentTime")))
    .toBeGreaterThan(0);
  await player.evaluate((element) => {
    Reflect.set(element, "currentTime", 1);
    const pause = Reflect.get(element, "pause");
    if (typeof pause === "function") {
      pause.call(element);
    }
  });

  const varyingPixels = await player.evaluate((element) => {
    const media = Reflect.get(element, "media");
    const nativeVideo = media instanceof HTMLElement ? Reflect.get(media, "nativeEl") : null;
    if (!(nativeVideo instanceof HTMLVideoElement) || nativeVideo.videoWidth === 0) {
      return 0;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 18;
    const context = canvas.getContext("2d");
    if (context === null) {
      return 0;
    }
    context.drawImage(nativeVideo, 0, 0, canvas.width, canvas.height);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let changes = 0;
    for (let index = 4; index < data.length; index += 4) {
      if (
        data[index] !== data[index - 4] ||
        data[index + 1] !== data[index - 3] ||
        data[index + 2] !== data[index - 2]
      ) {
        changes += 1;
      }
    }
    return changes;
  });
  expect(varyingPixels).toBeGreaterThan(20);

  expect(page.url()).not.toContain(token);
  const storage = await page.evaluate(() => ({
    local: JSON.stringify(localStorage),
    session: JSON.stringify(sessionStorage),
  }));
  expect(storage.local).not.toContain(token);
  expect(storage.session).not.toContain(token);
  const scriptSources = await page.locator("script[src]").evaluateAll((scripts) =>
    scripts.flatMap((script) => {
      const source = script.getAttribute("src");
      return source === null ? [] : [new URL(source, document.baseURI).href];
    }),
  );
  const scriptBodies = await Promise.all(
    scriptSources.map(async (source) => (await page.request.get(source)).text()),
  );
  expect(scriptBodies.join("\n")).not.toContain(muxServerOnlySentinel);
  await expectAccessible(page);
  await expect(page).toHaveScreenshot("watch-ready.png", { fullPage: true });
});

test("watch route declares explicit report-only playback CSP", async ({ request }, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-mobile",
    "One transport-level CSP proof is sufficient.",
  );

  const response = await request.get("/izle/kiyidaki-sessizlik");
  const policy = response.headers()["content-security-policy-report-only"] ?? "";

  expect(response.status()).toBe(200);
  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("media-src 'self' blob: https://stream.mux.com");
  expect(policy).toContain("img-src 'self' data: blob: https://image.mux.com");
  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).not.toContain("*");
});

test("watch frame reserves its loading footprint", async ({ page }, testInfo) => {
  requirePublicJourneyViewport(testInfo.project.name);
  let releaseRequest: (() => void) | undefined;
  const requestGate = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  await page.route("**/api/v1/playback/sessions", async (route) => {
    await requestGate;
    await route.continue();
  });
  const sessionRequest = page.waitForRequest("**/api/v1/playback/sessions");

  await page.goto("/izle/kiyidaki-sessizlik");
  await sessionRequest;
  await expect(page.getByText("Gösterim izni hazırlanıyor")).toBeVisible();
  await expect(page).toHaveScreenshot("watch-loading.png", { fullPage: true });

  releaseRequest?.();
  await expect(page.locator("mux-player")).toBeVisible();
});

test("expired rights fail closed with stable unavailable copy", async ({ page }, testInfo) => {
  requirePublicJourneyViewport(testInfo.project.name);
  await page.goto("/izle/gece-vardiyasi");

  await expect(page.getByText("Bu film şu anda oynatılamıyor")).toBeVisible();
  await expect(page.getByText(/Destek kodu:/u)).toBeVisible();
  await expect(page.getByRole("button", { name: "Yeniden dene" })).toHaveCount(0);
  await expect(page.locator("mux-player")).toHaveCount(0);
  await expectAccessible(page);
  await expect(page).toHaveScreenshot("watch-unavailable.png", {
    fullPage: true,
    mask: [page.getByText(/Destek kodu:/u)],
    maskColor: "#000000",
  });
});

test("provider failure retries only after explicit visitor action", async ({ page }, testInfo) => {
  requirePublicJourneyViewport(testInfo.project.name);
  let sessionRequests = 0;
  page.on("response", (response) => {
    if (response.url().endsWith("/api/v1/playback/sessions")) {
      sessionRequests += 1;
    }
  });
  await page.goto("/izle/golgelerin-haritasi");

  const retry = page.getByRole("button", { name: "Yeniden dene" });
  await expect(retry).toBeVisible();
  await expect.poll(() => sessionRequests).toBe(1);
  await retry.click();
  await expect.poll(() => sessionRequests).toBe(2);
  await expect(retry).toBeVisible();
});
