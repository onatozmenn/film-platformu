import type {
  CatalogFilters,
  CatalogPageView,
  CatalogQueryPort,
  HomePageView,
  MovieDetailView,
  SearchPageView,
  SearchSuggestion,
} from "./catalog-query-port";

export function createCatalogQueries(port: CatalogQueryPort) {
  return {
    async getHomePage(): Promise<HomePageView> {
      const page = await port.getHomePage();

      return {
        ...page,
        rails: page.rails.filter((rail) => rail.movies.length > 0),
      };
    },
    getMovieBySlug(slug: string): Promise<MovieDetailView | null> {
      return port.getMovieBySlug(slug);
    },
    listMovies(filters: CatalogFilters): Promise<CatalogPageView> {
      return port.listMovies(filters);
    },
    searchMovies(query: string): Promise<SearchPageView> {
      return port.searchMovies(query);
    },
    suggestMovies(query: string, limit: number): Promise<readonly SearchSuggestion[]> {
      return port.suggestMovies(query, limit);
    },
  };
}
