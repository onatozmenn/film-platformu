import { z } from "zod";

import {
  MetadataProviderError,
  type MetadataCredit,
  type MetadataCreditKind,
  type MetadataMovie,
  type MetadataMovieSearchResult,
  type MetadataProviderPort,
} from "../application/metadata-provider-port";

export type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type TmdbMetadataProviderOptions = Readonly<{
  apiToken: string;
  fetchImplementation?: FetchImplementation;
  timeoutMs?: number;
}>;

const tmdbOrigin = "https://api.themoviedb.org";
const externalIdSchema = z
  .string()
  .trim()
  .regex(/^\d{1,12}$/u);
const querySchema = z.string().trim().min(2).max(80);
const imagePathSchema = z
  .string()
  .regex(/^\/[A-Za-z0-9/_-]+\.(?:jpg|png|webp)$/u)
  .refine((value) => !value.includes(".."))
  .nullable();
const dateSchema = z.union([
  z.literal(""),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u)
    .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))),
]);
const movieSummarySchema = z.object({
  id: z.number().int().positive(),
  original_title: z.string().max(160),
  overview: z.string().max(5_000),
  poster_path: imagePathSchema,
  release_date: dateSchema,
  title: z.string().min(1).max(160),
});
const searchResponseSchema = z.object({
  results: z.array(movieSummarySchema).max(20),
});
const castCreditSchema = z.object({
  character: z.string().max(160),
  id: z.number().int().positive(),
  name: z.string().min(1).max(160),
  order: z.number().int().nonnegative(),
  profile_path: imagePathSchema,
});
const crewCreditSchema = z.object({
  id: z.number().int().positive(),
  job: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  profile_path: imagePathSchema,
});
const movieResponseSchema = movieSummarySchema.extend({
  backdrop_path: imagePathSchema,
  credits: z.object({
    cast: z.array(castCreditSchema).max(2_000),
    crew: z.array(crewCreditSchema).max(2_000),
  }),
  genres: z
    .array(z.object({ id: z.number().int().positive(), name: z.string().min(1).max(80) }))
    .max(50),
  runtime: z
    .number()
    .int()
    .positive()
    .max(24 * 60)
    .nullable(),
});

function normalizeReleaseDate(value: string): string | null {
  return value.length === 0 ? null : value;
}

function mapSummary(summary: z.infer<typeof movieSummarySchema>): MetadataMovieSearchResult {
  return {
    externalId: String(summary.id),
    originalTitle: summary.original_title,
    posterPath: summary.poster_path,
    releaseDate: normalizeReleaseDate(summary.release_date),
    synopsis: summary.overview,
    title: summary.title,
  };
}

function mapCrewKind(job: string): MetadataCreditKind | null {
  switch (job) {
    case "Director":
      return "DIRECTOR";
    case "Screenplay":
    case "Story":
    case "Writer":
      return "WRITER";
    default:
      return null;
  }
}

function mapCredits(movie: z.infer<typeof movieResponseSchema>): readonly MetadataCredit[] {
  const crew = movie.credits.crew.flatMap((credit, index) => {
    const kind = mapCrewKind(credit.job);
    return kind === null
      ? []
      : [
          {
            billingOrder: index,
            characterName: null,
            kind,
            name: credit.name,
            personExternalId: String(credit.id),
            profileImagePath: credit.profile_path,
          } satisfies MetadataCredit,
        ];
  });
  const cast = movie.credits.cast.slice(0, 50).map((credit): MetadataCredit => ({
    billingOrder: credit.order,
    characterName: credit.character.length === 0 ? null : credit.character,
    kind: "CAST",
    name: credit.name,
    personExternalId: String(credit.id),
    profileImagePath: credit.profile_path,
  }));

  return [...crew, ...cast];
}

function invalidResponse(): MetadataProviderError {
  return new MetadataProviderError("invalid-response", "Metadata provider returned invalid data");
}

export function createTmdbMetadataProvider(
  options: TmdbMetadataProviderOptions,
): MetadataProviderPort {
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 5_000;

  async function request(url: URL): Promise<unknown | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;

    try {
      response = await fetchImplementation(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${options.apiToken}`,
        },
        signal: controller.signal,
      });
    } catch {
      throw new MetadataProviderError("unavailable", "Metadata provider request failed");
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new MetadataProviderError("unavailable", "Metadata provider request failed");
    }

    let body: string;
    try {
      body = await response.text();
    } catch {
      throw new MetadataProviderError("unavailable", "Metadata provider response failed");
    }
    if (body.length > 1_000_000) {
      throw invalidResponse();
    }

    try {
      return JSON.parse(body) as unknown;
    } catch {
      throw invalidResponse();
    }
  }

  return {
    async getMovie(externalId: string): Promise<MetadataMovie | null> {
      const parsedId = externalIdSchema.safeParse(externalId);
      if (!parsedId.success) {
        throw new MetadataProviderError("invalid-request", "Metadata movie ID is invalid");
      }

      const url = new URL(`/3/movie/${parsedId.data}`, tmdbOrigin);
      url.searchParams.set("append_to_response", "credits");
      url.searchParams.set("language", "tr-TR");
      const body = await request(url);
      if (body === null) {
        return null;
      }
      const parsed = movieResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw invalidResponse();
      }

      return {
        ...mapSummary(parsed.data),
        backdropPath: parsed.data.backdrop_path,
        credits: mapCredits(parsed.data),
        genres: parsed.data.genres.map((genre) => ({
          externalId: String(genre.id),
          name: genre.name,
        })),
        provider: "TMDB",
        runtimeMinutes: parsed.data.runtime,
      };
    },

    async searchMovies(query: string): Promise<readonly MetadataMovieSearchResult[]> {
      const parsedQuery = querySchema.safeParse(query);
      if (!parsedQuery.success) {
        throw new MetadataProviderError("invalid-request", "Metadata search query is invalid");
      }

      const url = new URL("/3/search/movie", tmdbOrigin);
      url.searchParams.set("include_adult", "false");
      url.searchParams.set("language", "tr-TR");
      url.searchParams.set("page", "1");
      url.searchParams.set("query", parsedQuery.data);
      const body = await request(url);
      const parsed = searchResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw invalidResponse();
      }

      return parsed.data.results.map(mapSummary);
    },
  };
}
