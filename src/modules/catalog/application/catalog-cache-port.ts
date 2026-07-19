export type CatalogInvalidation = Readonly<{
  collectionChanged?: boolean;
  expireImmediately?: boolean;
  movieIds?: readonly string[];
  movieSlugs?: readonly string[];
  searchChanged?: boolean;
}>;

export interface CatalogCacheInvalidator {
  invalidate(input: CatalogInvalidation): void;
}
