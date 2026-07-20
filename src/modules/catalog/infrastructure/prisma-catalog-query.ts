import type { Movie, Prisma, PrismaClient } from "@/generated/prisma/client";
import { CollectionState, CreditKind, PublicationState } from "@/generated/prisma/enums";
import { createPageInfo } from "@/shared/pagination/page";

import type {
  CatalogFilters,
  CatalogImage,
  CatalogPageView,
  CatalogQueryPort,
  FeaturedMovieView,
  HomePageView,
  HomeRailView,
  MovieCardView,
  MovieDetailView,
  SearchPageView,
  SearchSuggestion,
} from "../application/catalog-query-port";
import { getCatalogAttribution } from "../application/catalog-attribution";
import { normalizeCatalogSearchText } from "../domain/catalog-text";

const homeCollectionSlugs = [
  "ana-sayfa-one-cikan",
  "editorun-seckisi",
  "yeni-eklenenler",
  "ilk-on",
] as const;

const railDefinitions = [
  {
    id: "editorial",
    slug: "editorun-seckisi",
    title: "Editörün seçkisi",
    variant: "standard",
    viewAllHref: "/filmler?siralama=editor-secimi",
  },
  {
    id: "new",
    slug: "yeni-eklenenler",
    title: "Yeni eklenenler",
    variant: "standard",
    viewAllHref: "/filmler?siralama=yeni",
  },
  {
    id: "popular",
    slug: "ilk-on",
    title: "İlk on",
    variant: "ranked",
    viewAllHref: "/filmler?siralama=populer",
  },
] as const;

type MovieWithGenres = Prisma.MovieGetPayload<{
  include: { genres: { include: { genre: true } } };
}>;

type MovieWithDetail = Prisma.MovieGetPayload<{
  include: {
    credits: { include: { person: true } };
    genres: { include: { genre: true } };
    videoAssets: { include: { subtitleTracks: true } };
  };
}>;

type SearchIdRow = Readonly<{ id: string }>;
type RatingMap = ReadonlyMap<string, MovieCardView["rating"]>;

function visibleMovieWhere(now: Date): Prisma.MovieWhereInput {
  return {
    publicationState: PublicationState.PUBLISHED,
    OR: [{ publishAt: null }, { publishAt: { lte: now } }],
  };
}

function mapImage(
  src: string | null,
  alt: string | null,
  width: number | null,
  height: number | null,
  focalPosition: string | null,
): CatalogImage | null {
  if (src === null) {
    return null;
  }
  if (alt === null || width === null || height === null || focalPosition === null) {
    throw new Error("Catalog image metadata is incomplete");
  }

  return { alt, focalPosition, height, src, width };
}

function mapPoster(movie: Movie): CatalogImage | null {
  return mapImage(
    movie.posterSrc,
    movie.posterAlt,
    movie.posterWidth,
    movie.posterHeight,
    movie.posterFocalPosition,
  );
}

function mapBackdrop(movie: Movie): CatalogImage | null {
  return mapImage(
    movie.backdropSrc,
    movie.backdropAlt,
    movie.backdropWidth,
    movie.backdropHeight,
    movie.backdropFocalPosition,
  );
}

function mapCard(movie: Movie, ratings: RatingMap = new Map()): MovieCardView {
  return {
    id: movie.id,
    poster: mapPoster(movie),
    rating: ratings.get(movie.id) ?? null,
    slug: movie.slug,
    title: movie.title,
    year: movie.releaseDate.getUTCFullYear(),
  };
}

function mapFeatured(movie: MovieWithGenres, ratings: RatingMap = new Map()): FeaturedMovieView {
  return {
    ...mapCard(movie, ratings),
    ageRating: movie.ageRating,
    backdrop: mapBackdrop(movie),
    genres: movie.genres.map(({ genre }) => genre.name),
    runtimeMinutes: movie.runtimeMinutes,
    synopsis: movie.synopsis,
  };
}

async function loadAcceptedRatings(
  client: PrismaClient,
  movieIds: readonly string[],
): Promise<RatingMap> {
  if (movieIds.length === 0) {
    return new Map();
  }
  const aggregates = await client.rating.groupBy({
    by: ["movieId"],
    where: {
      movieId: { in: [...movieIds] },
      user: { profile: { is: { deletedAt: null, disabledAt: null } } },
    },
    _avg: { valueHalfStars: true },
    _count: { _all: true },
  });
  return new Map(
    aggregates.flatMap((aggregate) => {
      const averageHalfStars = aggregate._avg.valueHalfStars;
      return aggregate._count._all < 5 || averageHalfStars === null
        ? []
        : [
            [
              aggregate.movieId,
              {
                average: Math.round((averageHalfStars / 2) * 10) / 10,
                count: aggregate._count._all,
              },
            ] as const,
          ];
    }),
  );
}

function creditLabel(kind: CreditKind, displayLabel: string | null): string {
  if (displayLabel !== null) {
    return displayLabel;
  }

  switch (kind) {
    case CreditKind.DIRECTOR:
      return "Yönetmen";
    case CreditKind.WRITER:
      return "Senaryo";
    case CreditKind.CAST:
      return "Oyuncular";
    case CreditKind.OTHER:
      return "Diğer";
  }
}

function groupCredits(movie: MovieWithDetail): MovieDetailView["credits"] {
  const groups = new Map<string, string[]>();
  const ordered = [...movie.credits].sort((left, right) => left.billingOrder - right.billingOrder);

  for (const credit of ordered) {
    const label = creditLabel(credit.kind, credit.displayLabel);
    const names = groups.get(label) ?? [];
    names.push(credit.person.name);
    groups.set(label, names);
  }

  const preferredOrder = ["Yönetmen", "Senaryo", "Yapım", "Oyuncular", "Diğer"];
  const orderFor = (label: string) => {
    const index = preferredOrder.indexOf(label);
    return index === -1 ? preferredOrder.length : index;
  };
  return [...groups.entries()]
    .sort(
      ([left], [right]) => orderFor(left) - orderFor(right) || left.localeCompare(right, "tr-TR"),
    )
    .map(([label, names]) => ({ label, names }));
}

async function searchMovieIds(
  client: PrismaClient,
  query: string,
  now: Date,
  limit: number,
  offset: number = 0,
): Promise<readonly string[]> {
  const normalized = normalizeCatalogSearchText(query);
  const rows = await client.$queryRaw<SearchIdRow[]>`
    SELECT m.id
    FROM movies AS m
    WHERE m.publication_state = 'PUBLISHED'::"PublicationState"
      AND (m.publish_at IS NULL OR m.publish_at <= ${now})
      AND (
        strpos(m.title_search, ${normalized}) > 0
        OR strpos(COALESCE(m.original_title_search, ''), ${normalized}) > 0
        OR m.title_search % ${normalized}
        OR COALESCE(m.original_title_search, '') % ${normalized}
        OR EXISTS (
          SELECT 1
          FROM credits AS c
          INNER JOIN people AS p ON p.id = c.person_id
          WHERE c.movie_id = m.id
            AND (strpos(p.name_search, ${normalized}) > 0 OR p.name_search % ${normalized})
        )
      )
    ORDER BY GREATEST(
      similarity(m.title_search, ${normalized}),
      similarity(COALESCE(m.original_title_search, ''), ${normalized}),
      COALESCE((
        SELECT MAX(similarity(p.name_search, ${normalized}))
        FROM credits AS c
        INNER JOIN people AS p ON p.id = c.person_id
        WHERE c.movie_id = m.id
      ), 0)
    ) DESC,
    m.title ASC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  return rows.map((row) => row.id);
}

async function countSearchMovies(client: PrismaClient, query: string, now: Date): Promise<number> {
  const normalized = normalizeCatalogSearchText(query);
  const [row] = await client.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count
    FROM movies AS m
    WHERE m.publication_state = 'PUBLISHED'::"PublicationState"
      AND (m.publish_at IS NULL OR m.publish_at <= ${now})
      AND (
        strpos(m.title_search, ${normalized}) > 0
        OR strpos(COALESCE(m.original_title_search, ''), ${normalized}) > 0
        OR m.title_search % ${normalized}
        OR COALESCE(m.original_title_search, '') % ${normalized}
        OR EXISTS (
          SELECT 1
          FROM credits AS c
          INNER JOIN people AS p ON p.id = c.person_id
          WHERE c.movie_id = m.id
            AND (strpos(p.name_search, ${normalized}) > 0 OR p.name_search % ${normalized})
        )
      )
  `;

  return Number(row?.count ?? 0n);
}

async function loadCardsByIds(
  client: PrismaClient,
  ids: readonly string[],
  now: Date,
): Promise<readonly MovieCardView[]> {
  if (ids.length === 0) {
    return [];
  }

  const movies = await client.movie.findMany({
    where: { AND: [visibleMovieWhere(now), { id: { in: [...ids] } }] },
  });
  const ratings = await loadAcceptedRatings(client, ids);
  const byId = new Map(movies.map((movie) => [movie.id, movie] as const));

  return ids.flatMap((id) => {
    const movie = byId.get(id);
    return movie === undefined ? [] : [mapCard(movie, ratings)];
  });
}

async function ratingSortedMovieIds(
  client: PrismaClient,
  filters: CatalogFilters,
  now: Date,
  limit: number,
  offset: number,
): Promise<readonly string[]> {
  const rows = await client.$queryRaw<SearchIdRow[]>`
    SELECT m.id
    FROM movies AS m
    LEFT JOIN (
      SELECT r.movie_id, AVG(r.value_half_stars) / 2.0 AS average, COUNT(*) AS count
      FROM ratings AS r
      INNER JOIN user_profiles AS profile ON profile.user_id = r.user_id
      WHERE profile.disabled_at IS NULL AND profile.deleted_at IS NULL
      GROUP BY r.movie_id
    ) AS accepted_rating ON accepted_rating.movie_id = m.id
    WHERE m.publication_state = 'PUBLISHED'::"PublicationState"
      AND (m.publish_at IS NULL OR m.publish_at <= ${now})
      AND (
        ${filters.genre}::text IS NULL
        OR EXISTS (
          SELECT 1
          FROM movie_genres AS movie_genre
          INNER JOIN genres AS genre ON genre.id = movie_genre.genre_id
          WHERE movie_genre.movie_id = m.id AND genre.slug = ${filters.genre}
        )
      )
      AND (
        ${filters.year}::integer IS NULL
        OR EXTRACT(YEAR FROM m.release_date)::integer = ${filters.year}
      )
    ORDER BY
      CASE WHEN accepted_rating.count >= 5 THEN accepted_rating.average END DESC NULLS LAST,
      m.title ASC,
      m.id ASC
    LIMIT ${limit}
    OFFSET ${offset}
  `;
  return rows.map(({ id }) => id);
}

export function createPrismaCatalogQuery(
  client: PrismaClient,
  now: () => Date = () => new Date(),
): CatalogQueryPort {
  return {
    async getHomePage(): Promise<HomePageView> {
      const at = now();
      const collections = await client.collection.findMany({
        where: {
          slug: { in: [...homeCollectionSlugs] },
          state: CollectionState.PUBLISHED,
        },
        include: {
          movies: {
            where: { movie: visibleMovieWhere(at) },
            orderBy: { position: "asc" },
            include: {
              movie: { include: { genres: { include: { genre: true } } } },
            },
          },
        },
      });
      const bySlug = new Map(
        collections.map((collection) => [collection.slug, collection] as const),
      );
      const featuredCollection = bySlug.get("ana-sayfa-one-cikan");
      const featuredMovie = featuredCollection?.movies[0]?.movie;

      if (featuredMovie === undefined) {
        throw new Error("Published home page has no featured movie");
      }

      const homeMovies = collections.flatMap((collection) =>
        collection.movies.map(({ movie }) => movie),
      );
      const ratings = await loadAcceptedRatings(
        client,
        homeMovies.map(({ id }) => id),
      );

      const rails: HomeRailView[] = railDefinitions.map((definition) => ({
        id: definition.id,
        movies: (bySlug.get(definition.slug)?.movies ?? []).map(({ movie }) =>
          mapCard(movie, ratings),
        ),
        title: definition.title,
        variant: definition.variant,
        viewAllHref: definition.viewAllHref,
      }));

      return { featured: mapFeatured(featuredMovie, ratings), rails };
    },

    async getMovieBySlug(slug: string): Promise<MovieDetailView | null> {
      const at = now();
      const movie = await client.movie.findFirst({
        where: { AND: [visibleMovieWhere(at), { slug }] },
        include: {
          credits: { include: { person: true } },
          genres: { include: { genre: true } },
          videoAssets: {
            where: { isActive: true },
            include: { subtitleTracks: { orderBy: { languageTag: "asc" } } },
          },
        },
      });

      if (movie === null) {
        return null;
      }

      const genreIds = movie.genres.map(({ genreId }) => genreId);
      const candidates = await client.movie.findMany({
        where: {
          AND: [
            visibleMovieWhere(at),
            { id: { not: movie.id } },
            { genres: { some: { genreId: { in: genreIds } } } },
          ],
        },
        include: { genres: { include: { genre: true } } },
      });
      const similarMovies = candidates
        .map((candidate) => ({
          movie: candidate,
          overlap: candidate.genres.filter(({ genreId }) => genreIds.includes(genreId)).length,
        }))
        .sort(
          (left, right) =>
            right.overlap - left.overlap ||
            left.movie.title.localeCompare(right.movie.title, "tr-TR"),
        )
        .slice(0, 5);
      const ratings = await loadAcceptedRatings(client, [
        movie.id,
        ...similarMovies.map(({ movie: candidate }) => candidate.id),
      ]);

      return {
        ...mapFeatured(movie, ratings),
        attribution: getCatalogAttribution(movie.slug),
        credits: groupCredits(movie),
        isPlayable: false,
        originalTitle: movie.originalTitle,
        similarMovies: similarMovies.map(({ movie: candidate }) => mapCard(candidate, ratings)),
        subtitleLanguages: movie.videoAssets.flatMap((asset) =>
          asset.subtitleTracks.map((track) => track.label),
        ),
      };
    },

    async listMovies(filters: CatalogFilters): Promise<CatalogPageView> {
      const at = now();
      const filtersWhere: Prisma.MovieWhereInput = {
        ...(filters.genre === null ? {} : { genres: { some: { genre: { slug: filters.genre } } } }),
        ...(filters.year === null
          ? {}
          : {
              releaseDate: {
                gte: new Date(Date.UTC(filters.year, 0, 1)),
                lt: new Date(Date.UTC(filters.year + 1, 0, 1)),
              },
            }),
      };
      const where: Prisma.MovieWhereInput = { AND: [visibleMovieWhere(at), filtersWhere] };
      const collectionSlug =
        filters.sort === "populer"
          ? "ilk-on"
          : filters.sort === "editor-secimi"
            ? "editorun-seckisi"
            : null;
      const [total, visibleMovies, genres] = await Promise.all([
        client.movie.count({ where }),
        client.movie.findMany({
          where: visibleMovieWhere(at),
          select: { releaseDate: true },
        }),
        client.genre.findMany({
          where: { movies: { some: { movie: visibleMovieWhere(at) } } },
          orderBy: { name: "asc" },
        }),
      ]);
      const pageInfo = createPageInfo(total, filters.page);
      const offset = (pageInfo.page - 1) * pageInfo.pageSize;
      let movies: readonly Movie[];

      if (filters.sort === "puan") {
        const ids = await ratingSortedMovieIds(client, filters, at, pageInfo.pageSize, offset);
        const ratingMovies = await client.movie.findMany({ where: { id: { in: [...ids] } } });
        const byId = new Map(ratingMovies.map((movie) => [movie.id, movie] as const));
        movies = ids.flatMap((id) => {
          const movie = byId.get(id);
          return movie === undefined ? [] : [movie];
        });
      } else if (collectionSlug === null) {
        movies = await client.movie.findMany({
          where,
          orderBy:
            filters.sort === "yeni"
              ? [{ addedAt: "desc" }, { title: "asc" }, { id: "asc" }]
              : [{ title: "asc" }, { id: "asc" }],
          skip: offset,
          take: pageInfo.pageSize,
        });
      } else {
        const rankedWhere: Prisma.CollectionMovieWhereInput = {
          collection: { slug: collectionSlug },
          movie: { is: where },
        };
        const rankedCount = await client.collectionMovie.count({ where: rankedWhere });
        const rankedTake = Math.min(pageInfo.pageSize, Math.max(0, rankedCount - offset));
        const rankedEntries =
          rankedTake === 0
            ? []
            : await client.collectionMovie.findMany({
                where: rankedWhere,
                include: { movie: true },
                orderBy: { position: "asc" },
                skip: offset,
                take: rankedTake,
              });
        const remainingTake = pageInfo.pageSize - rankedEntries.length;
        const unrankedMovies =
          remainingTake === 0
            ? []
            : await client.movie.findMany({
                where: {
                  AND: [where, { collections: { none: { collection: { slug: collectionSlug } } } }],
                },
                orderBy: [{ title: "asc" }, { id: "asc" }],
                skip: Math.max(0, offset - rankedCount),
                take: remainingTake,
              });
        movies = [...rankedEntries.map(({ movie }) => movie), ...unrankedMovies];
      }

      const ratings = await loadAcceptedRatings(
        client,
        movies.map(({ id }) => id),
      );
      return {
        availableGenres: genres.map(({ name, slug: genreSlug }) => ({
          name,
          slug: genreSlug,
        })),
        availableYears: [
          ...new Set(visibleMovies.map(({ releaseDate }) => releaseDate.getUTCFullYear())),
        ].sort((left, right) => right - left),
        movies: movies.map((movie) => mapCard(movie, ratings)),
        pageInfo,
        total,
      };
    },

    async searchMovies(query: string, requestedPage: number): Promise<SearchPageView> {
      const at = now();
      const total = await countSearchMovies(client, query, at);
      const pageInfo = createPageInfo(total, requestedPage);
      const ids = await searchMovieIds(
        client,
        query,
        at,
        pageInfo.pageSize,
        (pageInfo.page - 1) * pageInfo.pageSize,
      );
      const movies = await loadCardsByIds(client, ids, at);
      return { movies, pageInfo, total };
    },

    async suggestMovies(query: string, limit: number): Promise<readonly SearchSuggestion[]> {
      const at = now();
      const ids = await searchMovieIds(client, query, at, limit);
      const movies = await loadCardsByIds(client, ids, at);
      return movies.map((movie) => ({
        id: movie.id,
        kind: "movie",
        poster: movie.poster,
        slug: movie.slug,
        title: movie.title,
        year: movie.year,
      }));
    },
  };
}
