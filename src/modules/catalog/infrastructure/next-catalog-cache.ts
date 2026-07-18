import "server-only";

import { revalidateTag } from "next/cache";

import type { CatalogCacheInvalidator } from "../application/catalog-cache-port";
import { catalogCacheTags } from "./catalog-cache-tags";

export const catalogCacheInvalidator: CatalogCacheInvalidator = {
  invalidate(input) {
    revalidateTag(catalogCacheTags.all, "max");

    if (input.collectionChanged === true) {
      revalidateTag(catalogCacheTags.collections, "max");
    }
    if (input.searchChanged === true) {
      revalidateTag(catalogCacheTags.search, "max");
    }
    for (const movieId of input.movieIds ?? []) {
      revalidateTag(catalogCacheTags.movie(movieId), "max");
    }
    for (const slug of input.movieSlugs ?? []) {
      revalidateTag(catalogCacheTags.movie(slug), "max");
    }
  },
};
