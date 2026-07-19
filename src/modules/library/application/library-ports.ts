import type { MovieCardView } from "@/modules/catalog/application/catalog-query-port";

import type { ProgressValue } from "../domain/progress-policy";

export type ProgressWriteResult = "duration-conflict" | "saved" | "stale";

export type MemberMovieState = Readonly<{
  inWatchlist: boolean;
  ratingHalfStars: number | null;
  resumeAtSeconds: number;
}>;

export type MemberLibraryView = Readonly<{
  continueWatching: readonly Readonly<{
    movie: MovieCardView;
    progressPercent: number;
  }>[];
  watchlist: readonly MovieCardView[];
}>;

export interface LibraryRepositoryPort {
  addToWatchlist(userId: string, movieId: string, now: Date): Promise<void>;
  clearAllProgress(userId: string): Promise<void>;
  clearProgress(userId: string, movieId: string): Promise<void>;
  getMemberLibrary(userId: string, now: Date): Promise<MemberLibraryView>;
  getMovieState(userId: string, movieId: string): Promise<MemberMovieState>;
  getResumePosition(userId: string, movieId: string): Promise<number>;
  removeFromWatchlist(userId: string, movieId: string): Promise<void>;
  removeRating(userId: string, movieId: string): Promise<void>;
  saveProgress(
    userId: string,
    movieId: string,
    value: ProgressValue,
    now: Date,
  ): Promise<ProgressWriteResult>;
  setRating(userId: string, movieId: string, valueHalfStars: number, now: Date): Promise<void>;
}
