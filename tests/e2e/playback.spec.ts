import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { z } from "zod";

const advertisingResponseSchema = z
  .object({
    fixtureScenario: z.enum(["blocked", "completed", "empty", "error", "timeout"]).optional(),
    personalized: z.boolean(),
    placement: z.literal("preroll"),
    provider: z.literal("google-ima"),
    tagUrl: z.url(),
  })
  .strict();
const playbackResponseSchema = z
  .object({
    data: z
      .object({
        advertising: advertisingResponseSchema.nullable(),
        playback: z.object({ token: z.string().min(1) }).passthrough(),
      })
      .passthrough(),
  })
  .passthrough();
const outcomeRequestSchema = z.object({
  outcome: z.enum(["blocked", "completed", "empty", "error", "skipped", "timeout"]),
  sessionId: z.string().regex(/^ps_[a-zA-Z0-9]+$/u),
});
const muxServerOnlySentinel = "mux-server-only-sentinel-do-not-ship";
const optionalAdProviderHosts = new Set([
  "googleads.g.doubleclick.net",
  "imasdk.googleapis.com",
  "pagead2.googlesyndication.com",
  "pubads.g.doubleclick.net",
  "tpc.googlesyndication.com",
]);

function isOptionalAdProviderRequest(url: string): boolean {
  return optionalAdProviderHosts.has(new URL(url).hostname);
}

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
  expect(payload.data.advertising).toBeNull();
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
  expect(policy).toContain("script-src 'self' 'unsafe-inline' https://imasdk.googleapis.com");
  expect(policy).toContain("frame-src https://imasdk.googleapis.com");
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

test("denied consent initializes no optional advertising request, storage, or telemetry", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-mobile",
    "One denied-consent network proof is sufficient.",
  );
  await page.setExtraHTTPHeaders({ "x-film-test-consent": "DENIED" });
  const optionalRequests: string[] = [];
  const outcomeRequests: string[] = [];
  page.on("request", (request) => {
    if (isOptionalAdProviderRequest(request.url())) {
      optionalRequests.push(request.url());
    }
    if (request.url().endsWith("/api/v1/advertising/outcomes")) {
      outcomeRequests.push(request.url());
    }
  });
  const sessionResponse = page.waitForResponse("**/api/v1/playback/sessions");

  await page.goto("/izle/kiyidaki-sessizlik");

  const session = playbackResponseSchema.parse((await (await sessionResponse).json()) as unknown);
  expect(session.data.advertising).toBeNull();
  await expect(page.locator("mux-player")).toBeVisible();
  await expect(page.getByRole("button", { name: "Filmi başlat" })).toHaveCount(0);
  expect(optionalRequests).toEqual([]);
  expect(outcomeRequests).toEqual([]);
  expect(
    await page.evaluate(() => `${JSON.stringify(localStorage)}${JSON.stringify(sessionStorage)}`),
  ).not.toMatch(/google-ima|doubleclick|NON_PERSONALIZED|PERSONALIZED/u);
});

test("non-personalized consent plays one visual preroll and hands off to content", async ({
  page,
}, testInfo) => {
  requirePublicJourneyViewport(testInfo.project.name);
  await page.setExtraHTTPHeaders({ "x-film-test-consent": "NON_PERSONALIZED" });
  let sessionRequests = 0;
  const optionalRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/v1/playback/sessions")) {
      sessionRequests += 1;
    }
    if (isOptionalAdProviderRequest(request.url())) {
      optionalRequests.push(request.url());
    }
  });
  const sessionResponse = page.waitForResponse("**/api/v1/playback/sessions");
  const outcomeResponse = page.waitForResponse("**/api/v1/advertising/outcomes");

  await page.goto("/izle/kiyidaki-sessizlik");

  const session = playbackResponseSchema.parse((await (await sessionResponse).json()) as unknown);
  expect(session.data.advertising).toMatchObject({
    fixtureScenario: "completed",
    personalized: false,
    placement: "preroll",
    provider: "google-ima",
  });
  const tag = new URL(session.data.advertising?.tagUrl ?? "");
  expect(tag.hostname).toBe("pubads.g.doubleclick.net");
  expect(tag.searchParams.get("npa")).toBe("1");
  expect(tag.href).not.toMatch(/email|movie|title|user/u);

  const player = page.locator("mux-player");
  await player.evaluate((element) => Reflect.set(element, "muted", true));
  await page.getByRole("button", { name: "Filmi başlat" }).click();
  await expect(page.locator(".watch-ad-fixture")).toBeVisible();
  await expectAccessible(page);
  await expect(page).toHaveScreenshot("watch-preroll.png", { fullPage: true });

  const outcome = await outcomeResponse;
  expect(outcome.status()).toBe(204);
  expect(outcomeRequestSchema.parse(outcome.request().postDataJSON())).toEqual({
    outcome: "completed",
    sessionId: expect.stringMatching(/^ps_[a-zA-Z0-9]+$/u),
  });
  await expect(page.locator(".watch-ad-fixture")).toHaveCount(0);
  await expect
    .poll(() => player.evaluate((element) => Reflect.get(element, "currentTime")))
    .toBeGreaterThan(0);
  expect(sessionRequests).toBe(1);
  expect(optionalRequests).toEqual([]);
  expect(
    await page.evaluate(() => `${JSON.stringify(localStorage)}${JSON.stringify(sessionStorage)}`),
  ).not.toContain(tag.href);
});

for (const scenario of ["blocked", "empty", "error", "timeout"] as const) {
  test(`${scenario} preroll fails open once without a session loop`, async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-mobile",
      "Failure handoff is viewport-independent.",
    );
    await page.setExtraHTTPHeaders({ "x-film-test-consent": "NON_PERSONALIZED" });
    let sessionRequests = 0;
    const optionalRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().endsWith("/api/v1/playback/sessions")) {
        sessionRequests += 1;
      }
      if (isOptionalAdProviderRequest(request.url())) {
        optionalRequests.push(request.url());
      }
    });
    await page.route("**/api/v1/playback/sessions", async (route) => {
      const response = await route.fetch();
      const parsed = playbackResponseSchema.parse((await response.json()) as unknown);
      if (parsed.data.advertising === null) {
        throw new Error("Expected a fake advertising opportunity");
      }
      await route.fulfill({
        response,
        json: {
          ...parsed,
          data: {
            ...parsed.data,
            advertising: { ...parsed.data.advertising, fixtureScenario: scenario },
          },
        },
      });
    });
    const outcomeResponse = page.waitForResponse("**/api/v1/advertising/outcomes");

    await page.goto("/izle/kiyidaki-sessizlik");
    const player = page.locator("mux-player");
    await player.evaluate((element) => Reflect.set(element, "muted", true));
    await page.getByRole("button", { name: "Filmi başlat" }).click();

    const outcome = await outcomeResponse;
    expect(outcomeRequestSchema.parse(outcome.request().postDataJSON())).toMatchObject({
      outcome: scenario,
    });
    await expect
      .poll(() => player.evaluate((element) => Reflect.get(element, "currentTime")))
      .toBeGreaterThan(0);
    expect(sessionRequests).toBe(1);
    expect(optionalRequests).toEqual([]);
    await expect(page.getByRole("button", { name: "Yeniden dene" })).toHaveCount(0);
  });
}
