import { describe, expect, it } from "vitest";

import { fixtureCatalogQuery } from "./fixture-catalog-query";

describe("fixture catalog query", () => {
  it("filters by genre and year before applying rating order", async () => {
    const result = await fixtureCatalogQuery.listMovies({
      genre: "dram",
      page: 1,
      sort: "puan",
      year: 2026,
    });

    expect(result.movies.map((movie) => movie.slug)).toEqual([
      "ay-isiginda-son-istasyon",
      "kiyidaki-sessizlik",
      "yarin-kalanlar",
    ]);
  });

  it("returns deterministic similar films and no playable grant assumption", async () => {
    const detail = await fixtureCatalogQuery.getMovieBySlug("ay-isiginda-son-istasyon");

    expect(detail?.isPlayable).toBe(false);
    expect(detail?.similarMovies.map((movie) => movie.slug)).toEqual([
      "kiyidaki-sessizlik",
      "golgelerin-haritasi",
      "sonbahar-provasi",
      "ruzgarin-unuttugu-sehrin-uzun-gecesi",
      "yarin-kalanlar",
    ]);
  });

  it("matches credited people without exposing non-movie records", async () => {
    const results = await fixtureCatalogQuery.searchMovies("Nehir Ekin", 1);
    const suggestions = await fixtureCatalogQuery.suggestMovies("Nehir", 1);

    expect(results.movies.map((movie) => movie.slug)).toEqual(["ay-isiginda-son-istasyon"]);
    expect(suggestions).toEqual([
      expect.objectContaining({ kind: "movie", slug: "ay-isiginda-son-istasyon" }),
    ]);
  });

  it("exposes the openly licensed film without assuming playback availability", async () => {
    const results = await fixtureCatalogQuery.searchMovies("Blender Foundation", 1);
    const detail = await fixtureCatalogQuery.getMovieBySlug("big-buck-bunny");

    expect(results.movies).toEqual([
      expect.objectContaining({ slug: "big-buck-bunny", title: "Big Buck Bunny" }),
    ]);
    expect(detail).toMatchObject({
      attribution: {
        creator: "Blender Foundation",
        licenseLabel: "Creative Commons Attribution 3.0",
      },
      isPlayable: false,
      poster: { src: "/fixtures/catalog/big-buck-bunny-backdrop.png" },
      runtimeMinutes: 10,
    });
  });

  it.each([
    ["editor-secimi", "ay-isiginda-son-istasyon"],
    ["yeni", "big-buck-bunny"],
    ["populer", "ay-isiginda-son-istasyon"],
  ] as const)("applies the %s ordering", async (sort, firstSlug) => {
    const result = await fixtureCatalogQuery.listMovies({
      genre: null,
      page: 1,
      sort,
      year: null,
    });

    expect(result.movies[0]?.slug).toBe(firstSlug);
  });

  it("returns an empty collection for an unknown but normalized genre", async () => {
    const result = await fixtureCatalogQuery.listMovies({
      genre: "olmayan-tur",
      page: 1,
      sort: "editor-secimi",
      year: null,
    });

    expect(result.movies).toEqual([]);
    expect(result.total).toBe(0);
  });
});
