export interface CatalogVisibilityPort {
  isVisibleMovie(movieId: string, now: Date): Promise<boolean>;
}
