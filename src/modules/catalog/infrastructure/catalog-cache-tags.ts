export const catalogCacheTags = {
  all: "catalog",
  collections: "catalog:collections",
  movie: (idOrSlug: string) => `catalog:movie:${idOrSlug}`,
  search: "catalog:search",
} as const;
