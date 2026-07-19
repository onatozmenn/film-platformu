import type { PrismaClient } from "@/generated/prisma/client";
import type { ActionFieldErrors, ActionResult } from "@/shared/application/action-result";
import { hasDatabaseErrorCode } from "@/shared/db/database-error";
import { normalizeCatalogSearchText } from "@/modules/catalog/domain/catalog-text";

import type {
  AdminCommandRepositoryPort,
  CollectionMutationView,
  ContentRightMutationView,
  MovieMutationView,
  ResolvedVideoAssetCommand,
  VideoAssetMutationView,
} from "../application/admin-command-port";
import {
  appendAuditEvent,
  isAuthorized,
  type AdminTransaction,
} from "./prisma-admin-command-support";

type CatalogAdminMethods = Pick<
  AdminCommandRepositoryPort,
  | "attachVideoAsset"
  | "reconcileVideoAsset"
  | "setContentRight"
  | "setMovieCredits"
  | "setSubtitleTracks"
  | "upsertCollection"
>;

type CatalogAdminOptions = Readonly<{
  supportedTerritories: readonly string[];
}>;

const transactionOptions = { maxWait: 2_000, timeout: 5_000 } as const;
const evidenceReferencePattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,159}$/u;
const languageTagPattern = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function invalid<T>(fieldErrors: ActionFieldErrors): ActionResult<T> {
  return { code: "INVALID_INPUT", fieldErrors, ok: false };
}

function movieView(
  movie: Readonly<{ id: string; revision: number; slug: string }>,
): MovieMutationView {
  return { id: movie.id, revision: movie.revision, slug: movie.slug };
}

async function incrementMovieRevision(
  transaction: AdminTransaction,
  movieId: string,
): Promise<Readonly<{ id: string; revision: number; slug: string }>> {
  return transaction.movie.update({
    where: { id: movieId },
    data: { revision: { increment: 1 } },
    select: { id: true, revision: true, slug: true },
  });
}

function validateCredits(
  credits: Parameters<CatalogAdminMethods["setMovieCredits"]>[0]["credits"],
): ActionFieldErrors | null {
  if (credits.length > 200) {
    return { credits: ["Bir filmde en fazla 200 jenerik kaydı olabilir."] };
  }
  const naturalKeys = new Set<string>();
  for (const credit of credits) {
    const name = credit.personName.trim();
    if (
      name.length < 1 ||
      name.length > 160 ||
      !Number.isInteger(credit.billingOrder) ||
      credit.billingOrder < 0 ||
      (credit.characterName !== null && credit.characterName.trim().length > 160) ||
      (credit.displayLabel !== null && credit.displayLabel.trim().length > 80)
    ) {
      return { credits: ["Jenerik kaydı geçerli ad, sıra ve etiket sınırlarına uymalıdır."] };
    }
    const key = `${normalizeCatalogSearchText(name)}:${credit.kind}:${credit.characterName?.trim() ?? ""}`;
    if (naturalKeys.has(key)) {
      return { credits: ["Aynı jenerik kaydı bir filmde tekrarlanamaz."] };
    }
    naturalKeys.add(key);
  }
  return null;
}

function validateCollection(
  command: Parameters<CatalogAdminMethods["upsertCollection"]>[0],
): ActionFieldErrors | null {
  const errors: Record<string, readonly string[]> = {};
  if (!slugPattern.test(command.slug) || command.slug.length > 96) {
    errors.slug = ["Seçki adresi geçerli değildir."];
  }
  if (command.title.trim().length < 1 || command.title.trim().length > 160) {
    errors.title = ["Seçki başlığı 1 ile 160 karakter arasında olmalıdır."];
  }
  if (command.description !== null && command.description.trim().length > 2_000) {
    errors.description = ["Seçki açıklaması 2000 karakteri aşamaz."];
  }
  if (!Number.isInteger(command.displayOrder) || command.displayOrder < 0) {
    errors.displayOrder = ["Görüntüleme sırası negatif olmayan bir tam sayı olmalıdır."];
  }
  if (command.movies.length > 100) {
    errors.movies = ["Bir seçkide en fazla 100 film olabilir."];
  } else {
    const movieIds = new Set(command.movies.map(({ movieId }) => movieId));
    const positions = new Set(command.movies.map(({ position }) => position));
    if (
      movieIds.size !== command.movies.length ||
      positions.size !== command.movies.length ||
      command.movies.some(({ position }) => !Number.isInteger(position) || position < 0)
    ) {
      errors.movies = [
        "Seçki film ve sıra değerleri benzersiz, negatif olmayan tam sayılar olmalıdır.",
      ];
    }
  }
  return Object.keys(errors).length === 0 ? null : errors;
}

function validateProviderAsset(command: ResolvedVideoAssetCommand): ActionFieldErrors | null {
  const providerAsset = command.providerAsset;
  if (
    providerAsset.providerAssetId !== command.providerAssetId ||
    providerAsset.providerAssetId.trim().length < 1 ||
    providerAsset.providerAssetId.length > 120
  ) {
    return { providerAssetId: ["Video varlığı kimliği geçerli değildir."] };
  }
  if (
    providerAsset.state === "READY" &&
    (providerAsset.playbackId === null ||
      providerAsset.playbackId.trim().length < 1 ||
      providerAsset.playbackId.length > 120 ||
      providerAsset.durationSeconds === null ||
      !Number.isInteger(providerAsset.durationSeconds) ||
      providerAsset.durationSeconds <= 0)
  ) {
    return {
      providerAssetId: ["Hazır video varlığının oynatma kimliği ve süresi eksiksiz olmalıdır."],
    };
  }
  if (command.makeActive && providerAsset.state !== "READY") {
    return { makeActive: ["Yalnızca hazır video varlığı etkinleştirilebilir."] };
  }
  return null;
}

function canReconcileAssetState(
  current: "DISABLED" | "ERRORED" | "PREPARING" | "READY",
  next: "ERRORED" | "PREPARING" | "READY",
): boolean {
  switch (current) {
    case "PREPARING":
      return true;
    case "READY":
      return next === "READY" || next === "ERRORED";
    case "ERRORED":
      return next === "ERRORED";
    case "DISABLED":
      return false;
  }
}

async function writeVideoAsset(
  client: PrismaClient,
  command: ResolvedVideoAssetCommand,
  action: "VIDEO_ASSET_ATTACHED" | "VIDEO_ASSET_RECONCILED",
): Promise<ActionResult<VideoAssetMutationView>> {
  const fieldErrors = validateProviderAsset(command);
  if (fieldErrors !== null) {
    return invalid(fieldErrors);
  }
  try {
    return await client.$transaction<ActionResult<VideoAssetMutationView>>(async (transaction) => {
      if (!(await isAuthorized(transaction, command.actorUserId, "MANAGE_ASSETS"))) {
        return { code: "FORBIDDEN", ok: false };
      }
      const movie = await transaction.movie.findUnique({
        where: { id: command.movieId },
        select: { id: true },
      });
      if (movie === null) {
        return { code: "NOT_FOUND", ok: false };
      }
      const existing = await transaction.videoAsset.findUnique({
        where: {
          provider_providerAssetId: {
            provider: "MUX",
            providerAssetId: command.providerAssetId,
          },
        },
        select: { id: true, isActive: true, movieId: true, state: true },
      });
      if (existing !== null && existing.movieId !== command.movieId) {
        return { code: "CONFLICT", ok: false };
      }
      if (
        existing !== null &&
        !canReconcileAssetState(existing.state, command.providerAsset.state)
      ) {
        return invalid({
          providerAssetId: ["Video varlığı geçersiz bir duruma geri döndürülemez."],
        });
      }
      if (command.makeActive) {
        await transaction.videoAsset.updateMany({
          where: { isActive: true, movieId: command.movieId },
          data: { isActive: false },
        });
      }
      const isActive =
        command.providerAsset.state === "READY" &&
        (command.makeActive || existing?.isActive === true);
      const data = {
        durationSeconds: command.providerAsset.durationSeconds,
        isActive,
        providerPlaybackId: command.providerAsset.playbackId,
        state: command.providerAsset.state,
      } as const;
      const videoAsset =
        existing === null
          ? await transaction.videoAsset.create({
              data: {
                ...data,
                movieId: command.movieId,
                provider: "MUX",
                providerAssetId: command.providerAssetId,
              },
              select: { id: true, movieId: true, state: true },
            })
          : await transaction.videoAsset.update({
              where: { id: existing.id },
              data,
              select: { id: true, movieId: true, state: true },
            });
      await incrementMovieRevision(transaction, command.movieId);
      await appendAuditEvent(transaction, {
        action,
        actorUserId: command.actorUserId,
        metadata: { active: videoAsset.state === "READY" && isActive, state: videoAsset.state },
        requestId: command.requestId,
        targetId: videoAsset.id,
        targetType: "VIDEO_ASSET",
      });
      return {
        data: { assetId: videoAsset.id, movieId: videoAsset.movieId, state: videoAsset.state },
        ok: true,
      };
    }, transactionOptions);
  } catch (error) {
    if (hasDatabaseErrorCode(error, "P2002", "23505")) {
      return { code: "CONFLICT", ok: false };
    }
    throw error;
  }
}

export function createPrismaCatalogAdminCommands(
  client: PrismaClient,
  options: CatalogAdminOptions,
): CatalogAdminMethods {
  return {
    attachVideoAsset(command) {
      return writeVideoAsset(client, command, "VIDEO_ASSET_ATTACHED");
    },

    reconcileVideoAsset(command) {
      return writeVideoAsset(client, command, "VIDEO_ASSET_RECONCILED");
    },

    async setContentRight(command) {
      if (
        !options.supportedTerritories.includes(command.territory) ||
        !/^[A-Z]{2}$/u.test(command.territory) ||
        !Number.isFinite(command.startsAt.getTime()) ||
        !Number.isFinite(command.endsAt.getTime()) ||
        command.startsAt.getTime() >= command.endsAt.getTime() ||
        !evidenceReferencePattern.test(command.evidenceReference)
      ) {
        return invalid({
          rights: ["Bölge, zaman aralığı ve dahili hak kanıtı geçerli olmalıdır."],
        });
      }
      try {
        return await client.$transaction<ActionResult<ContentRightMutationView>>(
          async (transaction) => {
            if (!(await isAuthorized(transaction, command.actorUserId, "MANAGE_RIGHTS"))) {
              return { code: "FORBIDDEN", ok: false };
            }
            const movie = await transaction.movie.findUnique({
              where: { id: command.movieId },
              select: { id: true },
            });
            if (movie === null) {
              return { code: "NOT_FOUND", ok: false };
            }
            if (command.rightId !== null) {
              const current = await transaction.contentRight.findFirst({
                where: { id: command.rightId, movieId: command.movieId },
                select: { id: true },
              });
              if (current === null) {
                return { code: "NOT_FOUND", ok: false };
              }
            }
            const contradictory = await transaction.contentRight.findFirst({
              where: {
                allowStreaming: { not: command.allowStreaming },
                endsAt: { gt: command.startsAt },
                ...(command.rightId === null ? {} : { id: { not: command.rightId } }),
                movieId: command.movieId,
                startsAt: { lt: command.endsAt },
                territory: command.territory,
              },
              select: { id: true },
            });
            if (contradictory !== null) {
              return { code: "CONFLICT", ok: false };
            }
            const data = {
              allowStreaming: command.allowStreaming,
              endsAt: command.endsAt,
              evidenceReference: command.evidenceReference,
              startsAt: command.startsAt,
              territory: command.territory,
            };
            const right =
              command.rightId === null
                ? await transaction.contentRight.create({
                    data: { ...data, movieId: command.movieId },
                    select: { id: true },
                  })
                : await transaction.contentRight.update({
                    where: { id: command.rightId },
                    data,
                    select: { id: true },
                  });
            await incrementMovieRevision(transaction, command.movieId);
            await appendAuditEvent(transaction, {
              action: "CONTENT_RIGHT_SET",
              actorUserId: command.actorUserId,
              metadata: {
                allowStreaming: command.allowStreaming,
                endsAt: command.endsAt.toISOString(),
                startsAt: command.startsAt.toISOString(),
                territory: command.territory,
              },
              requestId: command.requestId,
              targetId: right.id,
              targetType: "CONTENT_RIGHT",
            });
            return { data: { movieId: command.movieId, rightId: right.id }, ok: true };
          },
          transactionOptions,
        );
      } catch (error) {
        if (hasDatabaseErrorCode(error, "P2002", "P2004", "23P01", "23505")) {
          return { code: "CONFLICT", ok: false };
        }
        throw error;
      }
    },

    async setMovieCredits(command) {
      const fieldErrors = validateCredits(command.credits);
      if (fieldErrors !== null) {
        return invalid(fieldErrors);
      }
      return client.$transaction<ActionResult<MovieMutationView>>(async (transaction) => {
        if (!(await isAuthorized(transaction, command.actorUserId, "EDIT_CATALOG"))) {
          return { code: "FORBIDDEN", ok: false };
        }
        const current = await transaction.movie.findUnique({
          where: { id: command.movieId },
          select: { revision: true },
        });
        if (current === null) {
          return { code: "NOT_FOUND", ok: false };
        }
        if (current.revision !== command.expectedRevision) {
          return { code: "CONFLICT", ok: false };
        }
        const changed = await transaction.movie.updateMany({
          where: { id: command.movieId, revision: command.expectedRevision },
          data: { revision: { increment: 1 } },
        });
        if (changed.count !== 1) {
          return { code: "CONFLICT", ok: false };
        }
        await transaction.credit.deleteMany({ where: { movieId: command.movieId } });
        for (const credit of command.credits) {
          const name = credit.personName.trim();
          const nameSearch = normalizeCatalogSearchText(name);
          const existingPerson = await transaction.person.findFirst({
            where: { nameSearch, provider: null },
            orderBy: { id: "asc" },
            select: { id: true },
          });
          const person =
            existingPerson ??
            (await transaction.person.create({
              data: { name, nameSearch },
              select: { id: true },
            }));
          await transaction.credit.create({
            data: {
              billingOrder: credit.billingOrder,
              characterName: credit.characterName?.trim() ?? null,
              displayLabel: credit.displayLabel?.trim() ?? null,
              kind: credit.kind,
              movieId: command.movieId,
              personId: person.id,
            },
          });
        }
        const movie = await transaction.movie.findUniqueOrThrow({
          where: { id: command.movieId },
          select: { id: true, revision: true, slug: true },
        });
        await appendAuditEvent(transaction, {
          action: "MOVIE_CREDITS_SET",
          actorUserId: command.actorUserId,
          metadata: { count: command.credits.length, revisionAfter: movie.revision },
          requestId: command.requestId,
          targetId: movie.id,
          targetType: "MOVIE",
        });
        return { data: movieView(movie), ok: true };
      }, transactionOptions);
    },

    async setSubtitleTracks(command) {
      const naturalKeys = new Set(
        command.tracks.map((track) => `${track.languageTag}:${track.kind}`),
      );
      const providerIds = new Set(command.tracks.map(({ providerTrackId }) => providerTrackId));
      if (
        command.tracks.length > 50 ||
        command.tracks.filter(({ isDefault }) => isDefault).length > 1 ||
        naturalKeys.size !== command.tracks.length ||
        providerIds.size !== command.tracks.length ||
        command.tracks.some(
          (track) =>
            !languageTagPattern.test(track.languageTag) ||
            track.label.trim().length < 1 ||
            track.label.trim().length > 80 ||
            track.providerTrackId.trim().length < 1 ||
            track.providerTrackId.length > 120,
        )
      ) {
        return invalid({ tracks: ["Altyazı metadata kayıtları geçerli ve benzersiz olmalıdır."] });
      }
      return client.$transaction<ActionResult<VideoAssetMutationView>>(async (transaction) => {
        if (!(await isAuthorized(transaction, command.actorUserId, "EDIT_CATALOG"))) {
          return { code: "FORBIDDEN", ok: false };
        }
        const asset = await transaction.videoAsset.findFirst({
          where: { id: command.assetId, movieId: command.movieId },
          select: { id: true, movieId: true, state: true },
        });
        if (asset === null) {
          return { code: "NOT_FOUND", ok: false };
        }
        await transaction.subtitleTrack.deleteMany({ where: { videoAssetId: asset.id } });
        await transaction.subtitleTrack.createMany({
          data: command.tracks.map((track) => ({
            isDefault: track.isDefault,
            kind: track.kind,
            label: track.label.trim(),
            languageTag: track.languageTag,
            providerTrackId: track.providerTrackId,
            videoAssetId: asset.id,
          })),
        });
        await incrementMovieRevision(transaction, command.movieId);
        await appendAuditEvent(transaction, {
          action: "SUBTITLE_TRACKS_SET",
          actorUserId: command.actorUserId,
          metadata: { count: command.tracks.length },
          requestId: command.requestId,
          targetId: asset.id,
          targetType: "VIDEO_ASSET",
        });
        return {
          data: { assetId: asset.id, movieId: asset.movieId, state: asset.state },
          ok: true,
        };
      }, transactionOptions);
    },

    async upsertCollection(command) {
      const fieldErrors = validateCollection(command);
      if (fieldErrors !== null) {
        return invalid(fieldErrors);
      }
      try {
        return await client.$transaction<ActionResult<CollectionMutationView>>(
          async (transaction) => {
            if (!(await isAuthorized(transaction, command.actorUserId, "EDIT_CATALOG"))) {
              return { code: "FORBIDDEN", ok: false };
            }
            const movieCount = await transaction.movie.count({
              where: { id: { in: command.movies.map(({ movieId }) => movieId) } },
            });
            if (movieCount !== command.movies.length) {
              return invalid({ movies: ["Seçilen filmlerden biri bulunamadı."] });
            }
            let collection: Readonly<{ id: string; revision: number; slug: string }>;
            if (command.collectionId === null) {
              if (command.expectedRevision !== null) {
                return { code: "CONFLICT", ok: false };
              }
              collection = await transaction.collection.create({
                data: {
                  description: command.description?.trim() ?? null,
                  displayOrder: command.displayOrder,
                  movies: { create: command.movies.map((movie) => ({ ...movie })) },
                  slug: command.slug,
                  state: command.state,
                  title: command.title.trim(),
                },
                select: { id: true, revision: true, slug: true },
              });
            } else {
              if (command.expectedRevision === null) {
                return { code: "CONFLICT", ok: false };
              }
              const collectionId = command.collectionId;
              const changed = await transaction.collection.updateMany({
                where: { id: collectionId, revision: command.expectedRevision },
                data: {
                  description: command.description?.trim() ?? null,
                  displayOrder: command.displayOrder,
                  revision: { increment: 1 },
                  slug: command.slug,
                  state: command.state,
                  title: command.title.trim(),
                },
              });
              if (changed.count !== 1) {
                return { code: "CONFLICT", ok: false };
              }
              await transaction.collectionMovie.deleteMany({
                where: { collectionId },
              });
              await transaction.collectionMovie.createMany({
                data: command.movies.map((movie) => ({
                  collectionId,
                  ...movie,
                })),
              });
              collection = await transaction.collection.findUniqueOrThrow({
                where: { id: collectionId },
                select: { id: true, revision: true, slug: true },
              });
            }
            await appendAuditEvent(transaction, {
              action: "COLLECTION_UPDATED",
              actorUserId: command.actorUserId,
              metadata: {
                movieCount: command.movies.length,
                revisionAfter: collection.revision,
                state: command.state,
              },
              requestId: command.requestId,
              targetId: collection.id,
              targetType: "COLLECTION",
            });
            return { data: collection, ok: true };
          },
          transactionOptions,
        );
      } catch (error) {
        if (hasDatabaseErrorCode(error, "P2002", "P2003", "23503", "23505")) {
          return { code: "CONFLICT", ok: false };
        }
        throw error;
      }
    },
  };
}
