import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectAccessiblePage(page: Page): Promise<void> {
  await expect(page).toHaveTitle(/\S/u);
  const accessibility = await new AxeBuilder({ page }).analyze();
  const blockingViolations = accessibility.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
  expect(blockingViolations).toEqual([]);

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
}

test("home renders a loaded photographic hero and poster rail", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(message.text());
    }
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Kıyıdaki Sessizlik" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Editörün seçkisi" })).toBeVisible();
  await expect(page.locator(".hero-fallback__image")).toHaveJSProperty("complete", true);
  expect(
    await page
      .locator(".hero-fallback__image")
      .evaluate((image: HTMLImageElement) => image.naturalWidth > 0 && image.naturalHeight > 0),
  ).toBe(true);
  await expectAccessiblePage(page);
  expect(browserErrors).toEqual([]);
  await expect(page).toHaveScreenshot("home-discovery.png", { fullPage: true });
});

test("catalog filters are URL-backed, refresh-safe, and expose an empty state", async ({
  page,
}, testInfo) => {
  const usesFilterSheet = ["chromium-mobile", "chromium-tablet"].includes(testInfo.project.name);
  await page.goto("/filmler");
  if (usesFilterSheet) {
    await page.getByRole("button", { name: "Filtreler" }).click();
    await expect(page).toHaveScreenshot("catalog-filter-sheet.png", { fullPage: true });
  }
  let filterSurface = usesFilterSheet
    ? page.getByRole("dialog", { name: "Filmleri filtrele" })
    : page.locator(".catalog-filters--desktop");
  await filterSurface.getByRole("combobox", { name: "Tür", exact: true }).selectOption("dram");
  await filterSurface.getByRole("combobox", { name: "Yıl", exact: true }).selectOption("2026");
  await filterSurface.getByRole("combobox", { name: "Sıralama", exact: true }).selectOption("puan");
  await filterSurface.getByRole("button", { name: "Uygula" }).click();

  await expect(page).toHaveURL(/\/filmler\?.*tur=dram.*yil=2026.*siralama=puan/u);
  await page.reload();
  if (usesFilterSheet) {
    await page.getByRole("button", { name: "Filtreler" }).click();
  }
  filterSurface = usesFilterSheet
    ? page.getByRole("dialog", { name: "Filmleri filtrele" })
    : page.locator(".catalog-filters--desktop");
  await expect(filterSurface.getByRole("combobox", { name: "Tür", exact: true })).toHaveValue(
    "dram",
  );
  await expect(filterSurface.getByRole("combobox", { name: "Yıl", exact: true })).toHaveValue(
    "2026",
  );
  await expect(filterSurface.getByRole("combobox", { name: "Sıralama", exact: true })).toHaveValue(
    "puan",
  );
  if (usesFilterSheet) {
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Filtreler" })).toBeFocused();
  }
  await expect(page.locator(".catalog-grid .poster-item")).toHaveCount(3);
  await expectAccessiblePage(page);
  await expect(page).toHaveScreenshot("catalog-filtered.png", { fullPage: true });

  await page.goto("/filmler?tur=macera&yil=2026");
  await expect(
    page.getByRole("heading", { name: "Bu filtrelerle eşleşen film yok" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Macera filtresini kaldır" })).toBeVisible();
  await expectAccessiblePage(page);
  await expect(page).toHaveScreenshot("catalog-empty.png", { fullPage: true });
});

test("search suggestions are keyboard operable and person matches reach film detail", async ({
  page,
}) => {
  await page.goto("/arama");
  const input = page.getByRole("combobox", { name: "Film veya kişi ara" });

  await input.fill("Nehir");
  await expect(page.getByRole("option", { name: /Ay Işığında Son İstasyon/u })).toBeVisible();
  await expect(page).toHaveScreenshot("search-suggestions.png", { fullPage: true });
  await input.press("ArrowDown");
  await expect(input).toHaveAttribute(
    "aria-activedescendant",
    /00000000-0000-4000-8000-000000000007/u,
  );
  await input.press("Escape");
  await expect(input).toHaveValue("Nehir");
  await expect(page.getByRole("option")).toHaveCount(0);

  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/film\/ay-isiginda-son-istasyon$/u);
  await expect(
    page.getByRole("heading", { level: 1, name: "Ay Işığında Son İstasyon" }),
  ).toBeVisible();
  await expectAccessiblePage(page);

  await page.goto("/arama?q=Nehir%20Ekin");
  await expect(page.getByRole("heading", { name: "“Nehir Ekin” sonuçları" })).toBeVisible();
  await expect(page.locator(".catalog-grid .poster-item")).toHaveCount(1);
  await expectAccessiblePage(page);
  await expect(page).toHaveScreenshot("search-results.png", { fullPage: true });
});

test("detail handles long titles, partial metadata, and unavailable playback", async ({ page }) => {
  await page.goto("/film/ruzgarin-unuttugu-sehrin-uzun-gecesi");
  const longTitle = page.getByRole("heading", {
    level: 1,
    name: "Rüzgârın Unuttuğu Şehrin Bitmek Bilmeyen Uzun Gecesi",
  });

  await expect(longTitle).toBeVisible();
  await expect(longTitle).toHaveClass(/detail-title--long/u);
  await expect(page.getByText("Bu film şu anda oynatılamıyor.")).toBeVisible();
  await expect(page.getByRole("link", { name: "İzle" })).toHaveCount(0);
  await expectAccessiblePage(page);
  await expect(page).toHaveScreenshot("detail-long-unavailable.png", { fullPage: true });

  await page.goto("/film/kiyidaki-sessizlik");
  await expect(page.getByRole("heading", { level: 1, name: "Kıyıdaki Sessizlik" })).toBeVisible();
  await expect(page.getByText("Pelin Somer")).toBeVisible();
  await expect(page.getByText("13+")).toHaveCount(0);
  await expectAccessiblePage(page);
  await expect(page).toHaveScreenshot("detail-partial.png", { fullPage: true });
});

test("desktop rails expose beginning, middle, end, focus, and ranked states", async ({
  page,
}, testInfo) => {
  test.skip(
    !["chromium-desktop", "chromium-wide"].includes(testInfo.project.name),
    "Rail buttons are intentionally hidden in native-scroll layouts.",
  );
  await page.goto("/");
  const editorial = page.getByRole("region", { name: "Editörün seçkisi" });
  const rail = editorial.getByTestId("rail-editorial");
  const previous = editorial.getByRole("button", { name: "Önceki filmler" });
  const next = editorial.getByRole("button", { name: "Sonraki filmler" });

  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();
  await expect(editorial).toHaveScreenshot("rail-beginning.png");

  await next.click();
  await expect.poll(() => rail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await expect(previous).toBeEnabled();
  await expect(editorial).toHaveScreenshot("rail-middle.png");

  await rail.evaluate((element) => element.scrollTo({ left: element.scrollWidth }));
  await expect(next).toBeDisabled();
  const lastLink = editorial.locator(".poster-item__link").last();
  await lastLink.focus();
  await expect(lastLink).toBeFocused();
  await expect(editorial).toHaveScreenshot("rail-end-focus.png");

  const ranked = page.getByRole("region", { name: "İlk on" });
  await expect(
    ranked.getByRole("link", { name: "1. sırada Ay Işığında Son İstasyon" }),
  ).toBeVisible();
  await expect(ranked).toHaveScreenshot("rail-ranked.png");
});

test("long Turkish title fits at 320 CSS pixels with reduced motion", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-mobile", "One narrow-layout proof is sufficient.");
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/film/ruzgarin-unuttugu-sehrin-uzun-gecesi");
  const title = page.getByRole("heading", {
    level: 1,
    name: "Rüzgârın Unuttuğu Şehrin Bitmek Bilmeyen Uzun Gecesi",
  });

  await expect(title).toBeVisible();
  const box = await title.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(320);
  await expectAccessiblePage(page);
  expect(
    await page.locator("html").evaluate((element) => getComputedStyle(element).scrollBehavior),
  ).toBe("auto");
});

test("mobile and tablet layers trap and restore focus", async ({ page }, testInfo) => {
  test.skip(
    !["chromium-mobile", "chromium-tablet"].includes(testInfo.project.name),
    "Mobile layers are replaced by desktop navigation at this viewport.",
  );
  await page.goto("/");

  const menuTrigger = page.getByRole("button", { name: "Menü" });
  await menuTrigger.click();
  await expect(page.getByRole("dialog", { name: "Menü" })).toBeVisible();
  await expect(page).toHaveScreenshot("mobile-menu.png", { fullPage: true });
  await page.keyboard.press("Escape");
  await expect(menuTrigger).toBeFocused();

  const searchTrigger = page.getByRole("button", { name: "Ara" });
  await searchTrigger.click();
  await expect(page.getByRole("searchbox", { name: "Film adı" })).toBeFocused();
  await page.getByRole("searchbox", { name: "Film adı" }).fill("Kıyı");
  await expect(page).toHaveScreenshot("mobile-search-layer.png", { fullPage: true });
  await page.keyboard.press("Escape");
  await expect(searchTrigger).toBeFocused();
  await searchTrigger.click();
  await expect(page.getByRole("searchbox", { name: "Film adı" })).toHaveValue("Kıyı");
});

test("offline state preserves the current catalog page", async ({ context, page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-mobile",
    "One offline browser proof is sufficient.",
  );
  await page.goto("/filmler");
  await context.setOffline(true);

  await expect(page.getByRole("status")).toContainText("Çevrimdışısınız");
  await expect(page.getByRole("heading", { level: 1, name: "Filmler" })).toBeVisible();
  await expect(page.locator(".catalog-grid .poster-item")).toHaveCount(10);

  await context.setOffline(false);
});

test("draft, scheduled, future, and unpublished records stay out of sitemap and detail", async ({
  page,
  request,
}) => {
  const sitemap = await request.get("/sitemap.xml");
  const body = await sitemap.text();

  expect(sitemap.status()).toBe(200);
  expect(body).toContain("/film/kiyidaki-sessizlik");
  expect(body).not.toMatch(/kurgu-masasinda|gelecek-program|erken-yayin|programdan-kaldirilan/u);

  const hiddenResponse = await page.goto("/film/kurgu-masasinda");
  expect(hiddenResponse?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Bu sayfa programda yok" })).toBeVisible();

  const hiddenWatchResponse = await page.goto("/izle/kurgu-masasinda");
  expect(hiddenWatchResponse?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Bu sayfa programda yok" })).toBeVisible();
});
