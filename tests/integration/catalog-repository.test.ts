import type { PrismaClient } from "@/generated/prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPrismaCatalogQuery } from "@/modules/catalog/infrastructure/prisma-catalog-query";
import { createDatabaseClient } from "@/shared/db/client-factory";

const localTestDatabaseUrl =
  "postgresql://film:film@127.0.0.1:54329/film_platform_test?schema=public";
const fixedNow = new Date("2026-07-18T12:00:00.000Z");
const hiddenSlugs = [
  "kurgu-masasinda",
  "gelecek-program",
  "erken-yayin",
  "programdan-kaldirilan",
] as const;

function resolveTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL ?? localTestDatabaseUrl;
  if (!new URL(value).pathname.slice(1).endsWith("_test")) {
    throw new Error("Catalog integration tests require a database name ending in _test");
  }
  return value;
}

describe("Prisma catalog query", () => {
  let client: PrismaClient;
  let query: ReturnType<typeof createPrismaCatalogQuery>;

  beforeAll(() => {
    client = createDatabaseClient(resolveTestDatabaseUrl());
    query = createPrismaCatalogQuery(client, () => fixedNow);
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  it("returns only currently published records across every public query", async () => {
    const catalog = await query.listMovies({
      genre: null,
      page: 1,
      sort: "editor-secimi",
      year: null,
    });
    const home = await query.getHomePage();
    const search = await query.searchMovies("film", 1);

    expect(catalog.total).toBe(10);
    expect(catalog.movies.map(({ slug }) => slug)).not.toEqual(
      expect.arrayContaining([...hiddenSlugs]),
    );
    expect(home.featured.slug).toBe("kiyidaki-sessizlik");
    expect(home.rails).toHaveLength(3);
    expect(home.rails.flatMap((rail) => rail.movies.map(({ slug }) => slug))).not.toEqual(
      expect.arrayContaining([...hiddenSlugs]),
    );
    expect(search.movies.map(({ slug }) => slug)).not.toEqual(
      expect.arrayContaining([...hiddenSlugs]),
    );

    for (const slug of hiddenSlugs) {
      await expect(query.getMovieBySlug(slug)).resolves.toBeNull();
      await expect(query.searchMovies(slug, 1)).resolves.toMatchObject({ movies: [], total: 0 });
    }
  });

  it("filters and orders the database-backed catalog", async () => {
    const result = await query.listMovies({ genre: "dram", page: 1, sort: "yeni", year: 2026 });

    expect(result.movies.map(({ slug }) => slug)).toEqual([
      "yarin-kalanlar",
      "ay-isiginda-son-istasyon",
      "kiyidaki-sessizlik",
    ]);
    expect(result.availableGenres.map(({ slug }) => slug)).toContain("dram");
    expect(result.availableYears).toEqual([2026, 2025, 2024, 2023]);
  });

  it("maps detail credits and deterministic similar films without playback assumptions", async () => {
    const detail = await query.getMovieBySlug("ay-isiginda-son-istasyon");

    expect(detail).not.toBeNull();
    expect(detail?.isPlayable).toBe(false);
    expect(detail?.rating).toBeNull();
    expect(detail?.subtitleLanguages).toEqual([]);
    expect(detail?.credits).toEqual([
      { label: "Yönetmen", names: ["Selin Yalın"] },
      { label: "Senaryo", names: ["Emre Tan", "Selin Yalın"] },
      { label: "Oyuncular", names: ["Nehir Ekin", "Mert Alaz", "Duru İlhan"] },
    ]);
    expect(detail?.similarMovies).toHaveLength(5);

    const watchableDetail = await query.getMovieBySlug("kiyidaki-sessizlik");
    expect(watchableDetail?.subtitleLanguages).toEqual(["English", "Türkçe"]);
  });

  it("searches normalized titles, original titles, and credited people with a bounded suggestion contract", async () => {
    await expect(query.searchMovies("KIYIDAKİ", 1)).resolves.toMatchObject({
      movies: [expect.objectContaining({ slug: "kiyidaki-sessizlik" })],
      total: 1,
    });
    await expect(query.searchMovies("Last Station", 1)).resolves.toMatchObject({
      movies: [expect.objectContaining({ slug: "ay-isiginda-son-istasyon" })],
    });
    await expect(query.searchMovies("Nehir Ekin", 1)).resolves.toMatchObject({
      movies: [expect.objectContaining({ slug: "ay-isiginda-son-istasyon" })],
    });
    await expect(query.suggestMovies("Nehir", 1)).resolves.toEqual([
      expect.objectContaining({ kind: "movie", slug: "ay-isiginda-son-istasyon" }),
    ]);
  });

  it("returns bounded catalog and search pages with accurate clamped metadata", async () => {
    const temporarySlugs = Array.from(
      { length: 30 },
      (_, index) => `sayfalama-filmi-${String(index + 1).padStart(2, "0")}`,
    );

    await client.movie.createMany({
      data: temporarySlugs.map((slug, index) => ({
        addedAt: new Date(fixedNow.getTime() + index * 1_000),
        publicationState: "PUBLISHED",
        releaseDate: new Date("2026-01-01T00:00:00.000Z"),
        runtimeMinutes: 90,
        slug,
        synopsis: "Sayfalama sınırlarını doğrulamak için oluşturulan geçici film kaydıdır.",
        title: `Sayfalama Filmi ${String(index + 1).padStart(2, "0")}`,
        titleSearch: `sayfalama filmi ${String(index + 1).padStart(2, "0")}`,
      })),
    });

    try {
      const catalog = await query.listMovies({ genre: null, page: 99, sort: "yeni", year: null });
      const search = await query.searchMovies("sayfalama", 2);

      expect(catalog.total).toBe(40);
      expect(catalog.pageInfo).toEqual({ page: 2, pageSize: 24, totalPages: 2 });
      expect(catalog.movies).toHaveLength(16);
      expect(search.total).toBe(30);
      expect(search.pageInfo).toEqual({ page: 2, pageSize: 24, totalPages: 2 });
      expect(search.movies).toHaveLength(6);
    } finally {
      await client.movie.deleteMany({ where: { slug: { in: temporarySlugs } } });
    }
  });

  it("meets the warm search p95 fixture budget", async () => {
    await query.suggestMovies("Nehir", 6);
    const durations: number[] = [];

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const startedAt = performance.now();
      await query.suggestMovies("Nehir", 6);
      durations.push(performance.now() - startedAt);
    }

    durations.sort((left, right) => left - right);
    const p95 = durations[Math.ceil(durations.length * 0.95) - 1];
    expect(p95).toBeDefined();
    expect(p95).toBeLessThan(250);
  });

  it("installs catalog checks, natural uniqueness, and trigram indexes", async () => {
    const indexes = await client.$queryRaw<Array<{ indexName: string }>>`
      SELECT indexname AS "indexName"
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY indexname
    `;
    expect(indexes.map(({ indexName }) => indexName)).toEqual(
      expect.arrayContaining([
        "credits_natural_key",
        "movies_original_title_search_trgm_idx",
        "movies_title_search_trgm_idx",
        "people_name_search_trgm_idx",
      ]),
    );

    await expect(
      client.movie.create({
        data: {
          releaseDate: new Date("2026-01-01T00:00:00.000Z"),
          runtimeMinutes: 0,
          slug: "gecersiz-sure",
          synopsis: "Bu kayıt veritabanı süre kısıtını doğrulamak için hazırlanmıştır.",
          title: "Geçersiz Süre",
          titleSearch: "gecersiz sure",
        },
      }),
    ).rejects.toThrow();

    const existingCredit = await client.credit.findFirstOrThrow();
    await expect(
      client.credit.create({
        data: {
          billingOrder: existingCredit.billingOrder,
          characterName: existingCredit.characterName,
          displayLabel: existingCredit.displayLabel,
          kind: existingCredit.kind,
          movieId: existingCredit.movieId,
          personId: existingCredit.personId,
        },
      }),
    ).rejects.toThrow();
  });
});
