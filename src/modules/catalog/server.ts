import "server-only";

import { unstable_cache } from "next/cache";

import { database } from "@/shared/db/database";

import { createCatalogQueries } from "./application/catalog-queries";
import type { CatalogFilters } from "./application/catalog-query-port";
import { catalogCacheTags } from "./infrastructure/catalog-cache-tags";
import { createPrismaCatalogQuery } from "./infrastructure/prisma-catalog-query";

const uncachedQueries = createCatalogQueries(createPrismaCatalogQuery(database));

const getCachedHomePage = unstable_cache(() => uncachedQueries.getHomePage(), ["catalog-home-v1"], {
  revalidate: 300,
  tags: [catalogCacheTags.all, catalogCacheTags.collections],
});

const getCachedCatalog = unstable_cache(
  (filters: CatalogFilters) => uncachedQueries.listMovies(filters),
  ["catalog-list-v1"],
  {
    revalidate: 300,
    tags: [catalogCacheTags.all],
  },
);

const getCachedSearch = unstable_cache(
  (query: string, page: number) => uncachedQueries.searchMovies(query, page),
  ["catalog-search-v1"],
  {
    revalidate: 60,
    tags: [catalogCacheTags.all, catalogCacheTags.search],
  },
);

const getCachedSuggestions = unstable_cache(
  (query: string, limit: number) => uncachedQueries.suggestMovies(query, limit),
  ["catalog-suggestions-v1"],
  {
    revalidate: 60,
    tags: [catalogCacheTags.all, catalogCacheTags.search],
  },
);

export const catalogQueries = {
  getHomePage: getCachedHomePage,
  getMovieBySlug(slug: string) {
    return unstable_cache(() => uncachedQueries.getMovieBySlug(slug), ["catalog-detail-v1", slug], {
      revalidate: 300,
      tags: [catalogCacheTags.all, catalogCacheTags.movie(slug)],
    })();
  },
  listMovies: getCachedCatalog,
  searchMovies: getCachedSearch,
  suggestMovies: getCachedSuggestions,
};
