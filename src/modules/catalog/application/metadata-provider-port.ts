export type MetadataCreditKind = "CAST" | "DIRECTOR" | "WRITER";

export type MetadataCredit = Readonly<{
  billingOrder: number;
  characterName: string | null;
  kind: MetadataCreditKind;
  name: string;
  personExternalId: string;
  profileImagePath: string | null;
}>;

export type MetadataMovieSearchResult = Readonly<{
  externalId: string;
  originalTitle: string;
  posterPath: string | null;
  releaseDate: string | null;
  synopsis: string;
  title: string;
}>;

export type MetadataMovie = MetadataMovieSearchResult &
  Readonly<{
    backdropPath: string | null;
    credits: readonly MetadataCredit[];
    genres: readonly Readonly<{ externalId: string; name: string }>[];
    provider: "TMDB";
    runtimeMinutes: number | null;
  }>;

export type MetadataProviderErrorCode =
  "disabled" | "invalid-request" | "invalid-response" | "unavailable";

export class MetadataProviderError extends Error {
  constructor(
    readonly code: MetadataProviderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MetadataProviderError";
  }
}

export interface MetadataProviderPort {
  getMovie(externalId: string): Promise<MetadataMovie | null>;
  searchMovies(query: string): Promise<readonly MetadataMovieSearchResult[]>;
}
