import type { PageInfo } from "@/shared/pagination/page";

import type { CatalogAttribution } from "./catalog-attribution";

export type CatalogImage = Readonly<{
  alt: string;
  focalPosition: string;
  height: number;
  src: string;
  width: number;
}>;

export type MovieRating = Readonly<{
  average: number;
  count: number;
}>;

export type MovieCardView = Readonly<{
  id: string;
  poster: CatalogImage | null;
  rating: MovieRating | null;
  slug: string;
  title: string;
  year: number;
}>;

export type FeaturedMovieView = MovieCardView &
  Readonly<{
    ageRating: string | null;
    backdrop: CatalogImage | null;
    genres: readonly string[];
    runtimeMinutes: number;
    synopsis: string;
  }>;

export type HomeRailView = Readonly<{
  id: string;
  movies: readonly MovieCardView[];
  title: string;
  variant: "ranked" | "standard";
  viewAllHref: string | null;
}>;

export type HomePageView = Readonly<{
  featured: FeaturedMovieView;
  rails: readonly HomeRailView[];
}>;

export type CatalogSort = "editor-secimi" | "populer" | "puan" | "yeni";

export type CatalogFilters = Readonly<{
  genre: string | null;
  page: number;
  sort: CatalogSort;
  year: number | null;
}>;

export type CatalogFilterOption = Readonly<{
  name: string;
  slug: string;
}>;

export type CatalogPageView = Readonly<{
  availableGenres: readonly CatalogFilterOption[];
  availableYears: readonly number[];
  movies: readonly MovieCardView[];
  pageInfo: PageInfo;
  total: number;
}>;

export type CreditGroupView = Readonly<{
  label: string;
  names: readonly string[];
}>;

export type MovieDetailView = FeaturedMovieView &
  Readonly<{
    attribution: CatalogAttribution | null;
    credits: readonly CreditGroupView[];
    isPlayable: boolean;
    originalTitle: string | null;
    similarMovies: readonly MovieCardView[];
    subtitleLanguages: readonly string[];
  }>;

export type SearchSuggestion = Readonly<{
  id: string;
  kind: "movie";
  poster: CatalogImage | null;
  slug: string;
  title: string;
  year: number | null;
}>;

export type SearchPageView = Readonly<{
  movies: readonly MovieCardView[];
  pageInfo: PageInfo;
  total: number;
}>;

export interface CatalogQueryPort {
  getHomePage(): Promise<HomePageView>;
  getMovieBySlug(slug: string): Promise<MovieDetailView | null>;
  listMovies(filters: CatalogFilters): Promise<CatalogPageView>;
  searchMovies(query: string, page: number): Promise<SearchPageView>;
  suggestMovies(query: string, limit: number): Promise<readonly SearchSuggestion[]>;
}
