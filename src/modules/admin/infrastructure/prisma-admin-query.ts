import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type {
  CatalogImage,
  CreditGroupView,
  MovieDetailView,
} from "@/modules/catalog/application/catalog-query-port";
import { getCatalogAttribution } from "@/modules/catalog/application/catalog-attribution";
import type { AuditAction, AuditTargetType } from "@/modules/audit/application/audit-event";

import type {
  AdminActorView,
  AdminImageView,
  AdminMovieEditorView,
  AdminQueryPort,
} from "../application/admin-query-port";
import {
  hasPlatformCapability,
  type PlatformCapability,
  type PlatformRole,
} from "../domain/capability-policy";
import { redactAuditMetadata } from "./redact-audit-metadata";

function mapRole(role: "ADMIN" | "EDITOR" | "MEMBER"): PlatformRole {
  return role;
}

async function getAuthorizedActor(
  client: PrismaClient,
  actorUserId: string,
  capability: PlatformCapability,
): Promise<AdminActorView | null> {
  const profile = await client.userProfile.findUnique({
    where: { userId: actorUserId },
    select: {
      deletedAt: true,
      disabledAt: true,
      displayName: true,
      user: { select: { roles: { select: { role: true } } } },
    },
  });
  if (profile === null || profile.deletedAt !== null || profile.disabledAt !== null) {
    return null;
  }
  const roles = profile.user.roles.map(({ role }) => mapRole(role));
  return hasPlatformCapability(roles, capability)
    ? { displayName: profile.displayName, id: actorUserId, roles }
    : null;
}

function mapImage(
  src: string | null,
  alt: string | null,
  focalPosition: string | null,
  width: number | null,
  height: number | null,
): AdminImageView | null {
  if (src === null) {
    return null;
  }
  if (alt === null || focalPosition === null || width === null || height === null) {
    throw new Error("Admin image metadata is incomplete");
  }
  return { alt, focalPosition, height, src, width };
}

function publicImage(image: AdminImageView | null): CatalogImage | null {
  return image;
}

function auditAction(value: string): AuditAction | "UNKNOWN" {
  switch (value) {
    case "ACCOUNT_DISABLED":
    case "COLLECTION_UPDATED":
    case "CONTENT_RIGHT_SET":
    case "MOVIE_CREATED":
    case "MOVIE_CREDITS_SET":
    case "MOVIE_EDITORIAL_UPDATED":
    case "MOVIE_IMPORTED":
    case "MOVIE_PUBLICATION_FAILED":
    case "MOVIE_PUBLISHED":
    case "MOVIE_RETURNED_TO_DRAFT":
    case "MOVIE_SCHEDULED":
    case "MOVIE_UNPUBLISHED":
    case "ROLE_GRANTED":
    case "ROLE_REVOKED":
    case "SUBTITLE_TRACKS_SET":
    case "VIDEO_ASSET_ATTACHED":
    case "VIDEO_ASSET_RECONCILED":
    case "VIDEO_ASSET_STATE_CHANGED":
      return value;
    default:
      return "UNKNOWN";
  }
}

function auditTargetType(value: string): AuditTargetType | "UNKNOWN" {
  switch (value) {
    case "COLLECTION":
    case "CONTENT_RIGHT":
    case "MOVIE":
    case "USER":
    case "VIDEO_ASSET":
      return value;
    default:
      return "UNKNOWN";
  }
}

function creditGroups(
  credits: readonly Readonly<{
    billingOrder: number;
    kind: "CAST" | "DIRECTOR" | "OTHER" | "WRITER";
    person: Readonly<{ name: string }>;
  }>[],
): readonly CreditGroupView[] {
  const labels: Readonly<Record<(typeof credits)[number]["kind"], string>> = {
    CAST: "Oyuncular",
    DIRECTOR: "Yönetmen",
    OTHER: "Katkıda bulunanlar",
    WRITER: "Senaryo",
  };
  const groups = new Map<string, string[]>();
  for (const credit of [...credits].sort((left, right) => left.billingOrder - right.billingOrder)) {
    const label = labels[credit.kind];
    const names = groups.get(label) ?? [];
    names.push(credit.person.name);
    groups.set(label, names);
  }
  return [...groups].map(([label, names]) => ({ label, names }));
}

const editorMovieInclude = {
  contentRights: { orderBy: [{ territory: "asc" }, { startsAt: "asc" }] },
  credits: {
    include: { person: { select: { name: true } } },
    orderBy: [{ kind: "asc" }, { billingOrder: "asc" }],
  },
  genres: { select: { genreId: true } },
  videoAssets: {
    include: { subtitleTracks: { orderBy: [{ isDefault: "desc" }, { languageTag: "asc" }] } },
    orderBy: { createdAt: "desc" },
  },
} satisfies Prisma.MovieInclude;

type EditorMovieRow = Prisma.MovieGetPayload<{ include: typeof editorMovieInclude }>;

async function mapEditorMovie(
  client: PrismaClient,
  actor: AdminActorView,
  movie: EditorMovieRow,
): Promise<AdminMovieEditorView> {
  const genreOptions = await client.genre.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return {
    actor,
    ageRating: movie.ageRating,
    backdrop: mapImage(
      movie.backdropSrc,
      movie.backdropAlt,
      movie.backdropFocalPosition,
      movie.backdropWidth,
      movie.backdropHeight,
    ),
    contentRights: movie.contentRights,
    credits: movie.credits.map((credit) => ({
      billingOrder: credit.billingOrder,
      characterName: credit.characterName,
      displayLabel: credit.displayLabel,
      id: credit.id,
      kind: credit.kind,
      personName: credit.person.name,
    })),
    firstPublishedAt: movie.firstPublishedAt,
    genreIds: movie.genres.map(({ genreId }) => genreId),
    genreOptions,
    id: movie.id,
    lastPublishAttemptAt: movie.lastPublishAttemptAt,
    lastPublishFailure: movie.lastPublishFailure,
    originalTitle: movie.originalTitle,
    poster: mapImage(
      movie.posterSrc,
      movie.posterAlt,
      movie.posterFocalPosition,
      movie.posterWidth,
      movie.posterHeight,
    ),
    publicationState: movie.publicationState,
    publishAt: movie.publishAt,
    releaseDate: movie.releaseDate,
    revision: movie.revision,
    runtimeMinutes: movie.runtimeMinutes,
    slug: movie.slug,
    synopsis: movie.synopsis,
    title: movie.title,
    updatedAt: movie.updatedAt,
    videoAssets: movie.videoAssets.map((asset) => ({
      durationSeconds: asset.durationSeconds,
      id: asset.id,
      isActive: asset.isActive,
      providerAssetId: asset.providerAssetId,
      providerPlaybackId: asset.providerPlaybackId,
      state: asset.state,
      subtitleTracks: asset.subtitleTracks,
    })),
  };
}

export function createPrismaAdminQuery(client: PrismaClient): AdminQueryPort {
  return {
    async getWorkspace(actorUserId) {
      const actor = await getAuthorizedActor(client, actorUserId, "EDIT_CATALOG");
      if (actor === null) {
        return null;
      }
      const movies = await client.movie.findMany({
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        select: {
          id: true,
          lastPublishFailure: true,
          publicationState: true,
          publishAt: true,
          revision: true,
          slug: true,
          title: true,
          updatedAt: true,
        },
        take: 100,
      });
      const totals = { DRAFT: 0, PUBLISHED: 0, SCHEDULED: 0, UNPUBLISHED: 0 };
      for (const movie of movies) {
        totals[movie.publicationState] += 1;
      }
      return { actor, movies, totals };
    },

    async getMovie(actorUserId, movieId) {
      const actor = await getAuthorizedActor(client, actorUserId, "EDIT_CATALOG");
      if (actor === null) {
        return null;
      }
      const movie = await client.movie.findUnique({
        where: { id: movieId },
        include: editorMovieInclude,
      });
      return movie === null ? null : mapEditorMovie(client, actor, movie);
    },

    async getCreateMovie(actorUserId) {
      const actor = await getAuthorizedActor(client, actorUserId, "EDIT_CATALOG");
      if (actor === null) {
        return null;
      }
      const genreOptions = await client.genre.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });
      return { actor, genreOptions };
    },

    async getPreview(actorUserId, movieId): Promise<MovieDetailView | null> {
      const actor = await getAuthorizedActor(client, actorUserId, "PREVIEW_CATALOG");
      if (actor === null) {
        return null;
      }
      const movie = await client.movie.findUnique({
        where: { id: movieId },
        include: editorMovieInclude,
      });
      if (movie === null) {
        return null;
      }
      const poster = mapImage(
        movie.posterSrc,
        movie.posterAlt,
        movie.posterFocalPosition,
        movie.posterWidth,
        movie.posterHeight,
      );
      const backdrop = mapImage(
        movie.backdropSrc,
        movie.backdropAlt,
        movie.backdropFocalPosition,
        movie.backdropWidth,
        movie.backdropHeight,
      );
      return {
        ageRating: movie.ageRating,
        attribution: getCatalogAttribution(movie.slug),
        backdrop: publicImage(backdrop),
        credits: creditGroups(movie.credits),
        genres: (
          await client.movieGenre.findMany({
            where: { movieId },
            include: { genre: { select: { name: true } } },
            orderBy: { genre: { name: "asc" } },
          })
        ).map(({ genre }) => genre.name),
        id: movie.id,
        isPlayable: false,
        originalTitle: movie.originalTitle,
        poster: publicImage(poster),
        rating: null,
        runtimeMinutes: movie.runtimeMinutes,
        similarMovies: [],
        slug: movie.slug,
        subtitleLanguages: [
          ...new Set(
            movie.videoAssets.flatMap((asset) => asset.subtitleTracks.map(({ label }) => label)),
          ),
        ],
        synopsis: movie.synopsis,
        title: movie.title,
        year: movie.releaseDate.getUTCFullYear(),
      };
    },

    async getCollections(actorUserId) {
      const actor = await getAuthorizedActor(client, actorUserId, "EDIT_CATALOG");
      if (actor === null) {
        return null;
      }
      const [collections, movieOptions] = await Promise.all([
        client.collection.findMany({
          orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
          include: {
            movies: {
              orderBy: { position: "asc" },
              include: { movie: { select: { title: true } } },
            },
          },
        }),
        client.movie.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
      ]);
      return {
        actor,
        collections: collections.map((collection) => ({
          description: collection.description,
          displayOrder: collection.displayOrder,
          id: collection.id,
          movies: collection.movies.map((entry) => ({
            movieId: entry.movieId,
            position: entry.position,
            title: entry.movie.title,
          })),
          revision: collection.revision,
          slug: collection.slug,
          state: collection.state,
          title: collection.title,
        })),
        movieOptions,
      };
    },

    async getRoles(actorUserId) {
      const actor = await getAuthorizedActor(client, actorUserId, "MANAGE_ROLES");
      if (actor === null) {
        return null;
      }
      const profiles = await client.userProfile.findMany({
        where: { deletedAt: null },
        orderBy: { displayName: "asc" },
        select: {
          disabledAt: true,
          displayName: true,
          userId: true,
          user: { select: { email: true, roles: { select: { role: true } } } },
        },
      });
      return {
        accounts: profiles.map((profile) => ({
          disabledAt: profile.disabledAt,
          displayName: profile.displayName,
          email: profile.user.email,
          id: profile.userId,
          roles: profile.user.roles.map(({ role }) => mapRole(role)),
        })),
        actor,
      };
    },

    async getAudit(actorUserId, limit) {
      const actor = await getAuthorizedActor(client, actorUserId, "VIEW_AUDIT");
      if (actor === null) {
        return null;
      }
      const events = await client.auditEvent.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: Math.min(Math.max(limit, 1), 100),
      });
      return {
        actor,
        events: events.map((event) => ({
          action: auditAction(event.action),
          actorType: event.actorType,
          actorUserId: event.actorUserId,
          createdAt: event.createdAt,
          id: event.id,
          metadata: redactAuditMetadata(event.metadata),
          requestId: event.requestId,
          targetId: event.targetId,
          targetType: auditTargetType(event.targetType),
        })),
      };
    },
  };
}
