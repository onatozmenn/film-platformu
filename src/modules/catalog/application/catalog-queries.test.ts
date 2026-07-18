import { describe, expect, it } from "vitest";

import type { CatalogQueryPort, HomePageView } from "./catalog-query-port";
import { createCatalogQueries } from "./catalog-queries";

const page: HomePageView = {
  featured: {
    ageRating: null,
    backdrop: null,
    genres: ["Dram"],
    id: "00000000-0000-4000-8000-000000000001",
    poster: null,
    rating: null,
    runtimeMinutes: 98,
    slug: "kiyidaki-sessizlik",
    synopsis: "Sessiz bir kıyı kasabasında geçmişin izleri yeniden belirir.",
    title: "Kıyıdaki Sessizlik",
    year: 2026,
  },
  rails: [
    {
      id: "visible",
      movies: [],
      title: "Boş olmayan",
      variant: "standard",
      viewAllHref: null,
    },
    {
      id: "empty",
      movies: [],
      title: "Boş seçki",
      variant: "standard",
      viewAllHref: null,
    },
  ],
};

const visibleRail = {
  id: "visible",
  movies: [page.featured],
  title: "Boş olmayan",
  variant: "standard",
  viewAllHref: null,
} as const;

describe("catalog queries", () => {
  it("omits empty editorial rails", async () => {
    const port: CatalogQueryPort = {
      getHomePage: async () => ({
        ...page,
        rails: [
          visibleRail,
          {
            id: "empty",
            movies: [],
            title: "Boş seçki",
            variant: "standard",
            viewAllHref: null,
          },
        ],
      }),
      getMovieBySlug: async () => null,
      listMovies: async () => ({
        availableGenres: [],
        availableYears: [],
        movies: [],
        total: 0,
      }),
      searchMovies: async () => ({ movies: [], total: 0 }),
      suggestMovies: async () => [],
    };

    const result = await createCatalogQueries(port).getHomePage();

    expect(result.rails).toHaveLength(1);
    expect(result.rails[0]?.id).toBe("visible");
  });
});
