import "server-only";

import { revalidateTag } from "next/cache";

import type { CatalogCacheInvalidator } from "../application/catalog-cache-port";
import { catalogCacheTags } from "./catalog-cache-tags";

export const catalogCacheInvalidator: CatalogCacheInvalidator = {
  invalidate(input) {
    const profile = input.expireImmediately === true ? { expire: 0 } : "max";
    revalidateTag(catalogCacheTags.all, profile);

    if (input.collectionChanged === true) {
      revalidateTag(catalogCacheTags.collections, profile);
    }
    if (input.searchChanged === true) {
      revalidateTag(catalogCacheTags.search, profile);
    }
    for (const movieId of input.movieIds ?? []) {
      revalidateTag(catalogCacheTags.movie(movieId), profile);
    }
    for (const slug of input.movieSlugs ?? []) {
      revalidateTag(catalogCacheTags.movie(slug), profile);
    }
  },
};
