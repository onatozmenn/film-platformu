import { createCatalogQueries } from "./application/catalog-queries";
import { fixtureCatalogQuery } from "./infrastructure/fixture-catalog-query";

export { parseCatalogFilters } from "./application/catalog-filters";
export type { CatalogSearchParams } from "./application/catalog-filters";
export { parseMovieSlug } from "./application/movie-slug";
export { normalizeSearchQuery, parseSuggestionLimit } from "./application/search-query";
export { CatalogScreen } from "./ui/catalog-screen";
export { HomeScreen } from "./ui/home-screen";
export { MovieDetailScreen } from "./ui/movie-detail-screen";
export { PublicShell } from "./ui/public-shell";
export { SearchScreen } from "./ui/search-screen";

export const catalogQueries = createCatalogQueries(fixtureCatalogQuery);
