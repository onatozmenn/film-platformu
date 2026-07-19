import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { z } from "zod";

const magicLinkSchema = z.object({ data: z.object({ url: z.url() }) }).strict();
const playbackSessionSchema = z
  .object({
    data: z.object({
      movie: z.object({ durationSeconds: z.number().positive(), id: z.uuid() }),
      resumeAtSeconds: z.number().nonnegative(),
    }),
  })
  .passthrough();

test.afterEach(async ({ page }) => {
  if (page.isClosed() || !page.url().startsWith("http")) {
    return;
  }
  await page
    .evaluate(async () => {
      await fetch("/api/v1/me/account", { method: "DELETE" });
    })
    .catch(() => undefined);
});

async function signIn(page: Page, email: string): Promise<string> {
  await page.goto("/giris");
  await page.getByLabel("E-posta adresi").fill(email);
  await page.getByRole("button", { name: "Giriş bağlantısı gönder" }).click();
  await expect(page).toHaveURL(/\/giris\/baglanti-gonderildi$/u);

  const linkResponse = await page.request.get(
    `/api/test/auth/magic-link?email=${encodeURIComponent(email)}`,
    { headers: { "x-film-test-harness": "1" }, maxRetries: 2 },
  );
  expect(linkResponse.status()).toBe(200);
  const { data } = magicLinkSchema.parse((await linkResponse.json()) as unknown);
  await page.goto(data.url);
  await expect(page).toHaveURL(/\/hesap$/u);
  return data.url;
}

async function verifyInSecondSession(browser: Browser, page: Page, email: string): Promise<void> {
  const context = await browser.newContext({ baseURL: new URL(page.url()).origin });
  const secondPage = await context.newPage();
  try {
    await signIn(secondPage, email);
    await secondPage.goto("/film/kiyidaki-sessizlik");
    await expect(secondPage.getByRole("button", { name: "Listemde" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(secondPage.locator(".member-rating-control output")).toHaveText("4 / 5");
  } finally {
    await context.close();
  }
}

test("member signs in with a one-time database session and signs out without token leakage", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-mobile",
    "The first auth transport proof is viewport-independent.",
  );
  const email = "browser-member@film-platform.invalid";

  await page.goto("/giris");
  await page.getByLabel("E-posta adresi").fill(email);
  await page.getByRole("button", { name: "Giriş bağlantısı gönder" }).click();
  await expect(page).toHaveURL(/\/giris\/baglanti-gonderildi$/u);
  await expect(page.getByRole("heading", { name: "Bağlantı hazırlandı" })).toBeVisible();

  const linkResponse = await page.request.get(
    `/api/test/auth/magic-link?email=${encodeURIComponent(email)}`,
    { headers: { "x-film-test-harness": "1" }, maxRetries: 2 },
  );
  expect(linkResponse.status()).toBe(200);
  const { data } = magicLinkSchema.parse((await linkResponse.json()) as unknown);
  expect(data.url).toContain("/api/auth/callback/email");
  expect(data.url).toContain("token=");
  const replay = await page.request.get(
    `/api/test/auth/magic-link?email=${encodeURIComponent(email)}`,
    {
      headers: { "x-film-test-harness": "1" },
      maxRetries: 2,
    },
  );
  expect(replay.status()).toBe(404);

  await page.goto(data.url);
  await expect(page).toHaveURL(/\/hesap$/u);
  await expect(page.getByRole("heading", { level: 1, name: "Film üyesi" })).toBeVisible();
  expect(page.url()).not.toContain("token=");
  expect(
    await page.evaluate(
      () =>
        `${location.href}${document.cookie}${JSON.stringify(localStorage)}${JSON.stringify(sessionStorage)}`,
    ),
  ).not.toContain(new URL(data.url).searchParams.get("token") ?? "token-should-not-be-empty");

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    ),
  ).toEqual([]);

  await page.getByRole("button", { name: "Oturumu kapat" }).click();
  await expect(page).toHaveURL(/\/$/u);
  await page.goto("/hesap");
  await expect(page).toHaveURL(/\/giris$/u);
});

test("member library persists watchlist, half-star rating, and resumable progress", async ({
  browser,
  page,
}, testInfo) => {
  test.skip(
    !["chromium-mobile", "chromium-desktop"].includes(testInfo.project.name),
    "Member visual evidence is required at mobile and desktop widths.",
  );
  const email = `browser-library-${testInfo.project.name}-${crypto.randomUUID()}@film-platform.invalid`;
  await signIn(page, email);

  await expect(page.getByText("Yarım bıraktığınız filmler burada görünür.")).toBeVisible();
  await expect(page.getByText("Listenizde henüz film yok.")).toBeVisible();
  await expect(page).toHaveScreenshot("account-empty.png", { fullPage: true });

  await page.goto("/film/kiyidaki-sessizlik");
  const watchlistResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/me/watchlist/") && response.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Listeme ekle" }).click();
  expect((await watchlistResponse).status()).toBe(204);
  await expect(page.getByRole("button", { name: "Listemde" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  const ratingResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/me/ratings/") && response.request().method() === "PUT",
  );
  const rating = page.getByRole("slider", { name: "Puanınız" });
  await rating.fill("8");
  await rating.press("Tab");
  expect((await ratingResponse).status()).toBe(204);
  await expect(page.locator(".member-rating-control output")).toHaveText("4 / 5");

  await page.reload();
  await expect(page.getByRole("button", { name: "Listemde" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".member-rating-control output")).toHaveText("4 / 5");

  await verifyInSecondSession(browser, page, email);

  const firstSessionResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/playback/sessions") &&
      response.request().method() === "POST",
  );
  await page.goto("/izle/kiyidaki-sessizlik");
  const firstSession = playbackSessionSchema.parse(
    (await (await firstSessionResponse).json()) as unknown,
  );
  expect(firstSession.data.resumeAtSeconds).toBe(0);
  const positionSeconds = 300;
  const progressStatus = await page.evaluate(
    async ({ durationSeconds, movieId, positionSeconds }) => {
      const response = await fetch(`/api/v1/me/progress/${movieId}`, {
        body: JSON.stringify({
          durationSeconds,
          observedAt: new Date().toISOString(),
          positionSeconds,
        }),
        headers: { "Content-Type": "application/json; charset=utf-8" },
        method: "PUT",
      });
      return response.status;
    },
    {
      durationSeconds: firstSession.data.movie.durationSeconds,
      movieId: firstSession.data.movie.id,
      positionSeconds,
    },
  );
  expect(progressStatus).toBe(204);

  const resumedSessionResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/playback/sessions") &&
      response.request().method() === "POST",
  );
  await page.reload();
  const resumedSession = playbackSessionSchema.parse(
    (await (await resumedSessionResponse).json()) as unknown,
  );
  expect(resumedSession.data.resumeAtSeconds).toBe(positionSeconds);

  await page.goto("/hesap");
  await expect(page.getByRole("heading", { name: "İzlemeye devam et" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "İzleme listem" })).toBeVisible();
  await expect(page.getByLabel(/Yüzde \d+ izlendi/u)).toBeVisible();
  await expect(page.getByText("Kıyıdaki Sessizlik").first()).toBeVisible();
  await expect(page).toHaveScreenshot("account-populated.png", { fullPage: true });

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    ),
  ).toEqual([]);

  await page.getByRole("button", { name: "Geçmişi temizle" }).click();
  const dialog = page.getByRole("dialog", { name: "İzleme geçmişini temizle" });
  const clearResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/me/progress") && response.request().method() === "DELETE",
  );
  await dialog.getByRole("button", { name: "Geçmişi temizle" }).click();
  expect((await clearResponse).status()).toBe(204);
  await expect(page.getByText("Yarım bıraktığınız filmler burada görünür.")).toBeVisible();
  await expect(page.getByText("Kıyıdaki Sessizlik").first()).toBeVisible();
});

test("member confirms irreversible deletion and loses account access immediately", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-mobile",
    "The account-deletion transport proof is viewport-independent.",
  );
  const email = `browser-delete-${crypto.randomUUID()}@film-platform.invalid`;
  await signIn(page, email);

  await page.getByRole("button", { name: "Hesabı sil" }).click();
  const dialog = page.getByRole("dialog", { name: "Hesabı kalıcı olarak sil" });
  await expect(dialog.getByText(/Bu işlem geri alınamaz/u)).toBeVisible();
  const deletionResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/me/account") && response.request().method() === "DELETE",
  );
  await dialog.getByRole("button", { name: "Hesabı kalıcı olarak sil" }).click();

  expect((await deletionResponse).status()).toBe(204);
  await expect(page).toHaveURL(/\/$/u);
  await page.goto("/hesap");
  await expect(page).toHaveURL(/\/giris$/u);
});
