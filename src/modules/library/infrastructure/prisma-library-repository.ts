import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { PublicationState } from "@/generated/prisma/enums";
import type { MovieCardView } from "@/modules/catalog/application/catalog-query-port";

import type { LibraryRepositoryPort, ProgressWriteResult } from "../application/library-ports";

type MemberMovieRow = Readonly<{
  id: string;
  posterAlt: string | null;
  posterFocalPosition: string | null;
  posterHeight: number | null;
  posterSrc: string | null;
  posterWidth: number | null;
  releaseDate: Date;
  slug: string;
  title: string;
}>;

const memberMovieSelect = {
  id: true,
  posterAlt: true,
  posterFocalPosition: true,
  posterHeight: true,
  posterSrc: true,
  posterWidth: true,
  releaseDate: true,
  slug: true,
  title: true,
} satisfies Prisma.MovieSelect;

function visibleMovieWhere(now: Date): Prisma.MovieWhereInput {
  return {
    publicationState: PublicationState.PUBLISHED,
    OR: [{ publishAt: null }, { publishAt: { lte: now } }],
  };
}

function mapCard(movie: MemberMovieRow): MovieCardView {
  let poster: MovieCardView["poster"] = null;
  if (movie.posterSrc !== null) {
    if (
      movie.posterAlt === null ||
      movie.posterFocalPosition === null ||
      movie.posterHeight === null ||
      movie.posterWidth === null
    ) {
      throw new Error("Member-library poster metadata is incomplete");
    }
    poster = {
      alt: movie.posterAlt,
      focalPosition: movie.posterFocalPosition,
      height: movie.posterHeight,
      src: movie.posterSrc,
      width: movie.posterWidth,
    };
  }
  return {
    id: movie.id,
    poster,
    rating: null,
    slug: movie.slug,
    title: movie.title,
    year: movie.releaseDate.getUTCFullYear(),
  };
}

export function createPrismaLibraryRepository(client: PrismaClient): LibraryRepositoryPort {
  return {
    async addToWatchlist(userId, movieId, now) {
      await client.watchlistEntry.upsert({
        where: { userId_movieId: { movieId, userId } },
        create: { createdAt: now, movieId, userId },
        update: {},
      });
    },

    async clearAllProgress(userId) {
      await client.watchProgress.deleteMany({ where: { userId } });
    },

    async clearProgress(userId, movieId) {
      await client.watchProgress.deleteMany({ where: { movieId, userId } });
    },

    async getMemberLibrary(userId, now) {
      const [watchlist, progress] = await Promise.all([
        client.watchlistEntry.findMany({
          where: { movie: visibleMovieWhere(now), userId },
          orderBy: { createdAt: "desc" },
          select: { movie: { select: memberMovieSelect } },
          take: 48,
        }),
        client.watchProgress.findMany({
          where: {
            completed: false,
            movie: visibleMovieWhere(now),
            positionSeconds: { gt: 0 },
            userId,
          },
          orderBy: { lastWatchedAt: "desc" },
          select: {
            durationSeconds: true,
            movie: { select: memberMovieSelect },
            positionSeconds: true,
          },
          take: 24,
        }),
      ]);
      return {
        continueWatching: progress.map((entry) => ({
          movie: mapCard(entry.movie),
          progressPercent: Math.min(
            100,
            Math.max(1, Math.round((entry.positionSeconds / entry.durationSeconds) * 100)),
          ),
        })),
        watchlist: watchlist.map((entry) => mapCard(entry.movie)),
      };
    },

    async getMovieState(userId, movieId) {
      const [watchlist, rating, progress] = await Promise.all([
        client.watchlistEntry.findUnique({
          where: { userId_movieId: { movieId, userId } },
          select: { userId: true },
        }),
        client.rating.findUnique({
          where: { userId_movieId: { movieId, userId } },
          select: { valueHalfStars: true },
        }),
        client.watchProgress.findUnique({
          where: { userId_movieId: { movieId, userId } },
          select: { completed: true, positionSeconds: true },
        }),
      ]);
      return {
        inWatchlist: watchlist !== null,
        ratingHalfStars: rating?.valueHalfStars ?? null,
        resumeAtSeconds: progress === null || progress.completed ? 0 : progress.positionSeconds,
      };
    },

    async getResumePosition(userId, movieId) {
      const progress = await client.watchProgress.findUnique({
        where: { userId_movieId: { movieId, userId } },
        select: { completed: true, positionSeconds: true },
      });
      return progress === null || progress.completed ? 0 : progress.positionSeconds;
    },

    async removeFromWatchlist(userId, movieId) {
      await client.watchlistEntry.deleteMany({ where: { movieId, userId } });
    },

    async removeRating(userId, movieId) {
      await client.rating.deleteMany({ where: { movieId, userId } });
    },

    async saveProgress(userId, movieId, value, now): Promise<ProgressWriteResult> {
      const saved = await client.$queryRaw<Array<{ userId: string }>>`
        INSERT INTO "watch_progress" (
          "user_id", "movie_id", "position_seconds", "duration_seconds", "completed",
          "observed_at", "last_watched_at", "created_at", "updated_at"
        ) VALUES (
          ${userId}::uuid, ${movieId}::uuid, ${value.positionSeconds}, ${value.durationSeconds},
          ${value.completed}, ${value.observedAt}, ${now}, ${now}, ${now}
        )
        ON CONFLICT ("user_id", "movie_id") DO UPDATE SET
          "position_seconds" = EXCLUDED."position_seconds",
          "duration_seconds" = EXCLUDED."duration_seconds",
          "completed" = EXCLUDED."completed",
          "observed_at" = EXCLUDED."observed_at",
          "last_watched_at" = EXCLUDED."last_watched_at",
          "updated_at" = EXCLUDED."updated_at"
        WHERE "watch_progress"."observed_at" <= EXCLUDED."observed_at"
          AND abs("watch_progress"."duration_seconds" - EXCLUDED."duration_seconds")
            <= greatest(5.0, "watch_progress"."duration_seconds" * 0.02)
        RETURNING "user_id" AS "userId"
      `;
      if (saved.length > 0) {
        return "saved";
      }

      const current = await client.watchProgress.findUnique({
        where: { userId_movieId: { movieId, userId } },
        select: { observedAt: true },
      });
      return current !== null && current.observedAt.getTime() > value.observedAt.getTime()
        ? "stale"
        : "duration-conflict";
    },

    async setRating(userId, movieId, valueHalfStars, now) {
      await client.rating.upsert({
        where: { userId_movieId: { movieId, userId } },
        create: { createdAt: now, movieId, updatedAt: now, userId, valueHalfStars },
        update: { updatedAt: now, valueHalfStars },
      });
    },
  };
}
