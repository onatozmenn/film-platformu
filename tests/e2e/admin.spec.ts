import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { z } from "zod";

const magicLinkSchema = z.object({ data: z.object({ url: z.url() }) }).strict();
const draftId = "00000000-0000-4000-8000-000000000101";

async function signIn(page: Page, email: string): Promise<void> {
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
}

async function resetFixture(request: APIRequestContext): Promise<void> {
  const response = await request.post("/api/test/admin/reset", {
    headers: { "x-film-test-harness": "1" },
  });
  expect(response.status()).toBe(204);
}

async function expectAccessible(page: Page): Promise<void> {
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    ),
  ).toEqual([]);
}

test("admin takes a licensed draft through preview, publication, audit, and unpublication", async ({
  page,
  request,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-desktop",
    "The complete admin journey is required at desktop width.",
  );
  test.setTimeout(90_000);
  await resetFixture(request);

  try {
    await signIn(page, "admin@film-platform.invalid");
    await page.goto("/yonetim");
    await expect(page.getByRole("heading", { level: 1, name: "Filmler" })).toBeVisible();
    await expect(page.getByText("Yönetici", { exact: true })).toBeVisible();
    await expectAccessible(page);
    await expect(page).toHaveScreenshot("admin-dashboard.png", { fullPage: true });

    await page.getByRole("link", { name: "Kurgu Masasında kaydını aç" }).click();
    const editorial = page.getByRole("region", { name: "Editoryal veri ve görseller" });
    await editorial.getByLabel("Dram").check();
    const poster = editorial.getByRole("group", { name: "Afiş" });
    await poster.getByLabel("Yerel dosya yolu").fill("/fixtures/catalog/fog-coast.jpg");
    await poster.getByLabel("Alternatif metin").fill("Sis altında kayalık Pasifik kıyısı");
    await poster.getByLabel("Genişlik").fill("1840");
    await poster.getByLabel("Yükseklik").fill("1228");
    const backdrop = editorial.getByRole("group", { name: "Fon görseli" });
    await backdrop.getByLabel("Yerel dosya yolu").fill("/fixtures/catalog/theater-interior.jpg");
    await backdrop.getByLabel("Alternatif metin").fill("Perdesi kapalı tarihî tiyatro salonu");
    await backdrop.getByLabel("Genişlik").fill("1024");
    await backdrop.getByLabel("Yükseklik").fill("810");
    await editorial.getByRole("button", { name: "Editoryal veriyi kaydet" }).click();
    await expect(page.getByRole("status")).toContainText("birlikte kaydedildi");
    await expectAccessible(page);
    await expect(page).toHaveScreenshot("admin-editor.png", { fullPage: true });

    const assets = page.getByRole("region", { name: "Video ve altyazılar" });
    await assets.getByLabel("Mux varlık kimliği").fill("fake-asset-admin-browser-ready");
    await assets.getByLabel("Hazırsa etkinleştir").check();
    await assets.getByRole("button", { name: "Varlığı ekle" }).click();
    await expect(page.getByRole("status")).toContainText("birlikte kaydedildi");
    await expect(page.getByText("fake-asset-admin-browser-ready")).toBeVisible();

    const rights = page.getByRole("region", { name: "Gösterim hakları" });
    const rightForm = rights.locator(".admin-right-form").last();
    await rightForm.getByLabel("Başlangıç (UTC)").fill("2026-01-01T00:00");
    await rightForm.getByLabel("Bitiş (UTC)").fill("2035-01-01T00:00");
    await rightForm.getByLabel("Dahili kanıt referansı").fill("fixture-license:admin-browser-tr");
    await rightForm.getByRole("button", { name: "Hak penceresi ekle" }).click();
    await expect(page.getByRole("status")).toContainText("birlikte kaydedildi");

    await page.getByRole("link", { name: "Önizle" }).click();
    await expect(page.getByText("Bu görünüm ortak katalogda yayınlanmaz.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Kurgu Masasında" })).toBeVisible();
    await expectAccessible(page);
    await expect(page).toHaveScreenshot("admin-preview.png", { fullPage: true });

    await page.goto(`/yonetim/filmler/${draftId}`);
    await page.getByRole("button", { name: "Şimdi yayınla" }).click();
    await expect(page.getByRole("status")).toContainText("birlikte kaydedildi");
    await expect(page.getByText("Yayında", { exact: true }).first()).toBeVisible();

    await page.goto("/film/kurgu-masasinda");
    await expect(page.getByRole("heading", { level: 1, name: "Kurgu Masasında" })).toBeVisible();
    await expect(page.getByRole("link", { name: "İzle" })).toBeVisible();

    await page.goto("/yonetim/denetim");
    await expect(page.getByText("MOVIE_PUBLISHED").first()).toBeVisible();
    await expect(page.getByText("CONTENT_RIGHT_SET").first()).toBeVisible();
    await expect(page.getByText("VIDEO_ASSET_ATTACHED").first()).toBeVisible();
    await expect(page.getByText("fixture-license:admin-browser-tr")).toHaveCount(0);
    await expectAccessible(page);
    await expect(page).toHaveScreenshot("admin-audit.png", { fullPage: true });

    await page.goto(`/yonetim/filmler/${draftId}`);
    await page.getByLabel("Yayından kaldırma nedeni").selectOption("EDITORIAL");
    await page.getByRole("button", { name: "Yayından kaldır" }).click();
    await expect(page.getByRole("status")).toContainText("birlikte kaydedildi");
    const hiddenResponse = await page.goto("/film/kurgu-masasinda");
    expect(hiddenResponse?.status()).toBe(404);
  } finally {
    await resetFixture(request);
  }
});

test("editor admin shell is keyboard-accessible and overflow-free at narrow width", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-mobile",
    "The admin narrow-layout smoke is required at 360px.",
  );
  await signIn(page, "editor@film-platform.invalid");
  await page.goto("/yonetim");
  await expect(page.getByRole("heading", { level: 1, name: "Filmler" })).toBeVisible();
  await page.getByText("Menü", { exact: true }).click();
  await expect(page.getByRole("link", { name: "Seçkiler" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expectAccessible(page);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(1);
});
