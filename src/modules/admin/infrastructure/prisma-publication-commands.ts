import type { PrismaClient } from "@/generated/prisma/client";
import { createMovieSlug, normalizeCatalogSearchText } from "@/modules/catalog/domain/catalog-text";
import type { ActionResult } from "@/shared/application/action-result";
import { hasDatabaseErrorCode } from "@/shared/db/database-error";

import type {
  AdminCommandRepositoryPort,
  ImportMovieDraftCommand,
  MovieEditorialInput,
  MovieMutationView,
} from "../application/admin-command-port";
import {
  evaluatePublicationReadiness,
  evaluateScheduleReadiness,
} from "../domain/publication-policy";
import {
  appendAuditEvent,
  isAuthorized,
  mapPublicationCandidate,
  publicationCandidateSelect,
  publicationDecisionErrors,
  validateEditorialInput,
  type AdminTransaction,
} from "./prisma-admin-command-support";

type PublicationCommandMethods = Pick<
  AdminCommandRepositoryPort,
  | "createMovieDraft"
  | "importMovieDraft"
  | "publishMovie"
  | "returnMovieToDraft"
  | "scheduleMovie"
  | "unpublishMovie"
  | "updateMovieEditorialData"
>;

type PublicationCommandOptions = Readonly<{
  clock: () => Date;
  supportedTerritories: readonly string[];
}>;

const transactionOptions = { maxWait: 2_000, timeout: 5_000 } as const;

function imageColumns(input: MovieEditorialInput) {
  return {
    ageRating: input.ageRating?.trim() ?? null,
    backdropAlt: input.backdrop?.alt.trim() ?? null,
    backdropFocalPosition: input.backdrop?.focalPosition ?? null,
    backdropHeight: input.backdrop?.height ?? null,
    backdropSrc: input.backdrop?.src ?? null,
    backdropWidth: input.backdrop?.width ?? null,
    originalTitle: input.originalTitle?.trim() ?? null,
    originalTitleSearch:
      input.originalTitle === null ? null : normalizeCatalogSearchText(input.originalTitle),
    posterAlt: input.poster?.alt.trim() ?? null,
    posterFocalPosition: input.poster?.focalPosition ?? null,
    posterHeight: input.poster?.height ?? null,
    posterSrc: input.poster?.src ?? null,
    posterWidth: input.poster?.width ?? null,
    releaseDate: input.releaseDate,
    runtimeMinutes: input.runtimeMinutes,
    slug: input.slug,
    synopsis: input.synopsis.trim(),
    title: input.title.trim(),
    titleSearch: normalizeCatalogSearchText(input.title),
  };
}

function movieView(
  movie: Readonly<{ id: string; revision: number; slug: string }>,
): MovieMutationView {
  return { id: movie.id, revision: movie.revision, slug: movie.slug };
}

function invalid<T>(fieldErrors: Readonly<Record<string, readonly string[]>>): ActionResult<T> {
  return { code: "INVALID_INPUT", fieldErrors, ok: false };
}

function slugWithSuffix(base: string, suffix: string): string {
  const trimmed = base.slice(0, 96 - suffix.length).replace(/-+$/u, "");
  return `${trimmed}${suffix}`;
}

async function availableImportSlug(
  transaction: AdminTransaction,
  title: string,
  releaseDate: Date,
): Promise<string | null> {
  const base = createMovieSlug(title);
  if (base.length === 0) {
    return null;
  }
  const yearSuffix = `-${String(releaseDate.getUTCFullYear())}`;
  const candidates = [base, slugWithSuffix(base, yearSuffix)];
  for (let sequence = 2; sequence <= 100; sequence += 1) {
    candidates.push(slugWithSuffix(base, `${yearSuffix}-${String(sequence)}`));
  }
  for (const candidate of candidates) {
    const existing = await transaction.movie.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (existing === null) {
      return candidate;
    }
  }
  return null;
}

function validImportMetadata(command: ImportMovieDraftCommand): boolean {
  const metadata = command.metadata;
  return (
    metadata.provider === "TMDB" &&
    metadata.externalId === command.externalId &&
    /^\d{1,12}$/u.test(command.externalId) &&
    metadata.title.trim().length >= 1 &&
    metadata.title.trim().length <= 160 &&
    metadata.synopsis.trim().length >= 10 &&
    metadata.synopsis.trim().length <= 5_000 &&
    metadata.releaseDate !== null &&
    metadata.runtimeMinutes !== null &&
    Number.isInteger(metadata.runtimeMinutes) &&
    metadata.runtimeMinutes > 0 &&
    metadata.runtimeMinutes <= 1_440
  );
}

export function createPrismaPublicationCommands(
  client: PrismaClient,
  options: PublicationCommandOptions,
): PublicationCommandMethods {
  return {
    async createMovieDraft(command) {
      try {
        return await client.$transaction<ActionResult<MovieMutationView>>(async (transaction) => {
          if (!(await isAuthorized(transaction, command.actorUserId, "EDIT_CATALOG"))) {
            return { code: "FORBIDDEN", ok: false };
          }
          const fieldErrors = validateEditorialInput(command);
          if (fieldErrors !== null) {
            return invalid(fieldErrors);
          }
          const genreCount = await transaction.genre.count({
            where: { id: { in: [...command.genreIds] } },
          });
          if (genreCount !== command.genreIds.length) {
            return invalid({ genreIds: ["Seçilen türlerden biri bulunamadı."] });
          }

          const movie = await transaction.movie.create({
            data: {
              ...imageColumns(command),
              genres: { create: command.genreIds.map((genreId) => ({ genreId })) },
            },
            select: { id: true, revision: true, slug: true },
          });
          await appendAuditEvent(transaction, {
            action: "MOVIE_CREATED",
            actorUserId: command.actorUserId,
            metadata: { source: "MANUAL" },
            requestId: command.requestId,
            targetId: movie.id,
            targetType: "MOVIE",
          });
          return { data: movieView(movie), ok: true };
        }, transactionOptions);
      } catch (error) {
        if (hasDatabaseErrorCode(error, "P2002")) {
          return { code: "CONFLICT", ok: false };
        }
        throw error;
      }
    },

    async importMovieDraft(command) {
      if (!validImportMetadata(command)) {
        return invalid({ metadata: ["Sağlayıcı kaydı taslak için gerekli alanları içermiyor."] });
      }
      const metadata = command.metadata;
      const releaseDate = new Date(`${metadata.releaseDate ?? ""}T00:00:00.000Z`);
      if (!Number.isFinite(releaseDate.getTime())) {
        return invalid({ releaseDate: ["Sağlayıcı gösterim tarihi geçerli değil."] });
      }
      try {
        return await client.$transaction<ActionResult<MovieMutationView>>(async (transaction) => {
          if (!(await isAuthorized(transaction, command.actorUserId, "EDIT_CATALOG"))) {
            return { code: "FORBIDDEN", ok: false };
          }
          const slug = await availableImportSlug(transaction, metadata.title, releaseDate);
          if (slug === null) {
            return { code: "CONFLICT", ok: false };
          }
          const genres = await transaction.genre.findMany({ select: { id: true, name: true } });
          const importedGenreNames = new Set(
            metadata.genres.map(({ name }) => normalizeCatalogSearchText(name)),
          );
          const genreIds = genres
            .filter(({ name }) => importedGenreNames.has(normalizeCatalogSearchText(name)))
            .map(({ id }) => id);
          const originalTitle =
            normalizeCatalogSearchText(metadata.originalTitle) ===
            normalizeCatalogSearchText(metadata.title)
              ? null
              : metadata.originalTitle.trim();
          const movie = await transaction.movie.create({
            data: {
              genres: { create: genreIds.map((genreId) => ({ genreId })) },
              metadataSources: {
                create: {
                  externalId: command.externalId,
                  lastImportedAt: options.clock(),
                  provider: "TMDB",
                },
              },
              originalTitle,
              originalTitleSearch:
                originalTitle === null ? null : normalizeCatalogSearchText(originalTitle),
              releaseDate,
              runtimeMinutes: metadata.runtimeMinutes ?? 0,
              slug,
              synopsis: metadata.synopsis.trim(),
              title: metadata.title.trim(),
              titleSearch: normalizeCatalogSearchText(metadata.title),
            },
            select: { id: true, revision: true, slug: true },
          });
          const naturalCredits = new Set<string>();
          for (const credit of metadata.credits.slice(0, 200)) {
            const key = `${credit.personExternalId}:${credit.kind}:${credit.characterName ?? ""}`;
            if (naturalCredits.has(key)) {
              continue;
            }
            naturalCredits.add(key);
            const person = await transaction.person.upsert({
              where: {
                provider_providerPersonId: {
                  provider: "TMDB",
                  providerPersonId: credit.personExternalId,
                },
              },
              create: {
                name: credit.name.trim(),
                nameSearch: normalizeCatalogSearchText(credit.name),
                provider: "TMDB",
                providerPersonId: credit.personExternalId,
              },
              update: {
                name: credit.name.trim(),
                nameSearch: normalizeCatalogSearchText(credit.name),
              },
              select: { id: true },
            });
            await transaction.credit.create({
              data: {
                billingOrder: credit.billingOrder,
                characterName: credit.characterName,
                kind: credit.kind,
                movieId: movie.id,
                personId: person.id,
              },
            });
          }
          await appendAuditEvent(transaction, {
            action: "MOVIE_IMPORTED",
            actorUserId: command.actorUserId,
            metadata: { count: naturalCredits.size, source: "TMDB" },
            requestId: command.requestId,
            targetId: movie.id,
            targetType: "MOVIE",
          });
          return { data: movieView(movie), ok: true };
        }, transactionOptions);
      } catch (error) {
        if (hasDatabaseErrorCode(error, "P2002", "23505")) {
          return { code: "CONFLICT", ok: false };
        }
        throw error;
      }
    },

    async updateMovieEditorialData(command) {
      try {
        return await client.$transaction<ActionResult<MovieMutationView>>(async (transaction) => {
          if (!(await isAuthorized(transaction, command.actorUserId, "EDIT_CATALOG"))) {
            return { code: "FORBIDDEN", ok: false };
          }
          const fieldErrors = validateEditorialInput(command);
          if (fieldErrors !== null) {
            return invalid(fieldErrors);
          }
          const current = await transaction.movie.findUnique({
            where: { id: command.movieId },
            select: { firstPublishedAt: true, revision: true, slug: true },
          });
          if (current === null) {
            return { code: "NOT_FOUND", ok: false };
          }
          if (current.revision !== command.expectedRevision) {
            return { code: "CONFLICT", ok: false };
          }
          if (current.firstPublishedAt !== null && current.slug !== command.slug) {
            return invalid({ slug: ["Film adresi ilk yayından sonra değiştirilemez."] });
          }
          const genreCount = await transaction.genre.count({
            where: { id: { in: [...command.genreIds] } },
          });
          if (genreCount !== command.genreIds.length) {
            return invalid({ genreIds: ["Seçilen türlerden biri bulunamadı."] });
          }

          const changed = await transaction.movie.updateMany({
            where: { id: command.movieId, revision: command.expectedRevision },
            data: { ...imageColumns(command), revision: { increment: 1 } },
          });
          if (changed.count !== 1) {
            return { code: "CONFLICT", ok: false };
          }
          await transaction.movieGenre.deleteMany({ where: { movieId: command.movieId } });
          await transaction.movieGenre.createMany({
            data: command.genreIds.map((genreId) => ({ genreId, movieId: command.movieId })),
          });
          const movie = await transaction.movie.findUniqueOrThrow({
            where: { id: command.movieId },
            select: { id: true, revision: true, slug: true },
          });
          await appendAuditEvent(transaction, {
            action: "MOVIE_EDITORIAL_UPDATED",
            actorUserId: command.actorUserId,
            metadata: {
              revisionAfter: movie.revision,
              revisionBefore: command.expectedRevision,
            },
            requestId: command.requestId,
            targetId: movie.id,
            targetType: "MOVIE",
          });
          return { data: movieView(movie), ok: true };
        }, transactionOptions);
      } catch (error) {
        if (hasDatabaseErrorCode(error, "P2002")) {
          return { code: "CONFLICT", ok: false };
        }
        throw error;
      }
    },

    async scheduleMovie(command) {
      const now = options.clock();
      return client.$transaction<ActionResult<MovieMutationView>>(async (transaction) => {
        if (!(await isAuthorized(transaction, command.actorUserId, "PUBLISH_CATALOG"))) {
          return { code: "FORBIDDEN", ok: false };
        }
        const current = await transaction.movie.findUnique({
          where: { id: command.movieId },
          select: publicationCandidateSelect,
        });
        if (current === null) {
          return { code: "NOT_FOUND", ok: false };
        }
        if (current.revision !== command.expectedRevision) {
          return { code: "CONFLICT", ok: false };
        }
        if (current.publicationState === "PUBLISHED") {
          return invalid({ publication: ["Yayındaki film yeniden zamanlanamaz."] });
        }
        const decision = evaluateScheduleReadiness({
          candidate: mapPublicationCandidate(current),
          now,
          publishAt: command.publishAt,
          supportedTerritories: options.supportedTerritories,
        });
        const fieldErrors = publicationDecisionErrors(decision);
        if (fieldErrors !== null) {
          return invalid(fieldErrors);
        }
        const changed = await transaction.movie.updateMany({
          where: { id: command.movieId, revision: command.expectedRevision },
          data: {
            lastPublishAttemptAt: null,
            lastPublishFailure: null,
            publicationState: "SCHEDULED",
            publishAt: command.publishAt,
            revision: { increment: 1 },
          },
        });
        if (changed.count !== 1) {
          return { code: "CONFLICT", ok: false };
        }
        const movie = await transaction.movie.findUniqueOrThrow({
          where: { id: command.movieId },
          select: { id: true, revision: true, slug: true },
        });
        await appendAuditEvent(transaction, {
          action: "MOVIE_SCHEDULED",
          actorUserId: command.actorUserId,
          metadata: { publishAt: command.publishAt.toISOString() },
          requestId: command.requestId,
          targetId: movie.id,
          targetType: "MOVIE",
        });
        return { data: movieView(movie), ok: true };
      }, transactionOptions);
    },

    async publishMovie(command) {
      const now = options.clock();
      return client.$transaction<ActionResult<MovieMutationView>>(async (transaction) => {
        if (!(await isAuthorized(transaction, command.actorUserId, "PUBLISH_CATALOG"))) {
          return { code: "FORBIDDEN", ok: false };
        }
        const current = await transaction.movie.findUnique({
          where: { id: command.movieId },
          select: publicationCandidateSelect,
        });
        if (current === null) {
          return { code: "NOT_FOUND", ok: false };
        }
        if (current.revision !== command.expectedRevision) {
          return { code: "CONFLICT", ok: false };
        }
        if (current.publicationState === "PUBLISHED") {
          return { data: movieView(current), ok: true };
        }
        const decision = evaluatePublicationReadiness({
          at: now,
          candidate: mapPublicationCandidate(current),
          supportedTerritories: options.supportedTerritories,
        });
        const fieldErrors = publicationDecisionErrors(decision);
        if (fieldErrors !== null) {
          return invalid(fieldErrors);
        }
        const changed = await transaction.movie.updateMany({
          where: { id: command.movieId, revision: command.expectedRevision },
          data: {
            firstPublishedAt: current.firstPublishedAt ?? now,
            lastPublishAttemptAt: null,
            lastPublishFailure: null,
            publicationState: "PUBLISHED",
            publishAt: null,
            revision: { increment: 1 },
          },
        });
        if (changed.count !== 1) {
          return { code: "CONFLICT", ok: false };
        }
        const movie = await transaction.movie.findUniqueOrThrow({
          where: { id: command.movieId },
          select: { id: true, revision: true, slug: true },
        });
        await appendAuditEvent(transaction, {
          action: "MOVIE_PUBLISHED",
          actorUserId: command.actorUserId,
          metadata: { source: "MANUAL" },
          requestId: command.requestId,
          targetId: movie.id,
          targetType: "MOVIE",
        });
        return { data: movieView(movie), ok: true };
      }, transactionOptions);
    },

    async returnMovieToDraft(command) {
      return client.$transaction<ActionResult<MovieMutationView>>(async (transaction) => {
        if (!(await isAuthorized(transaction, command.actorUserId, "PUBLISH_CATALOG"))) {
          return { code: "FORBIDDEN", ok: false };
        }
        const current = await transaction.movie.findUnique({
          where: { id: command.movieId },
          select: { id: true, publicationState: true, revision: true, slug: true },
        });
        if (current === null) {
          return { code: "NOT_FOUND", ok: false };
        }
        if (current.revision !== command.expectedRevision) {
          return { code: "CONFLICT", ok: false };
        }
        if (current.publicationState === "DRAFT") {
          return { data: movieView(current), ok: true };
        }
        if (current.publicationState === "PUBLISHED") {
          return invalid({ publication: ["Yayındaki film önce yayından kaldırılmalıdır."] });
        }
        const changed = await transaction.movie.updateMany({
          where: { id: command.movieId, revision: command.expectedRevision },
          data: {
            lastPublishAttemptAt: null,
            lastPublishFailure: null,
            publicationState: "DRAFT",
            publishAt: null,
            revision: { increment: 1 },
          },
        });
        if (changed.count !== 1) {
          return { code: "CONFLICT", ok: false };
        }
        const movie = await transaction.movie.findUniqueOrThrow({
          where: { id: command.movieId },
          select: { id: true, revision: true, slug: true },
        });
        await appendAuditEvent(transaction, {
          action: "MOVIE_RETURNED_TO_DRAFT",
          actorUserId: command.actorUserId,
          metadata: { previousState: current.publicationState },
          requestId: command.requestId,
          targetId: movie.id,
          targetType: "MOVIE",
        });
        return { data: movieView(movie), ok: true };
      }, transactionOptions);
    },

    async unpublishMovie(command) {
      return client.$transaction<ActionResult<MovieMutationView>>(async (transaction) => {
        if (!(await isAuthorized(transaction, command.actorUserId, "PUBLISH_CATALOG"))) {
          return { code: "FORBIDDEN", ok: false };
        }
        const current = await transaction.movie.findUnique({
          where: { id: command.movieId },
          select: { id: true, publicationState: true, revision: true, slug: true },
        });
        if (current === null) {
          return { code: "NOT_FOUND", ok: false };
        }
        if (current.revision !== command.expectedRevision) {
          return { code: "CONFLICT", ok: false };
        }
        if (current.publicationState === "UNPUBLISHED") {
          return { data: movieView(current), ok: true };
        }
        if (current.publicationState !== "PUBLISHED") {
          return invalid({ publication: ["Yalnızca yayındaki film yayından kaldırılabilir."] });
        }
        const changed = await transaction.movie.updateMany({
          where: { id: command.movieId, revision: command.expectedRevision },
          data: {
            lastPublishAttemptAt: null,
            lastPublishFailure: null,
            publicationState: "UNPUBLISHED",
            publishAt: null,
            revision: { increment: 1 },
          },
        });
        if (changed.count !== 1) {
          return { code: "CONFLICT", ok: false };
        }
        const movie = await transaction.movie.findUniqueOrThrow({
          where: { id: command.movieId },
          select: { id: true, revision: true, slug: true },
        });
        await appendAuditEvent(transaction, {
          action: "MOVIE_UNPUBLISHED",
          actorUserId: command.actorUserId,
          metadata: { reason: command.reason },
          requestId: command.requestId,
          targetId: movie.id,
          targetType: "MOVIE",
        });
        return { data: movieView(movie), ok: true };
      }, transactionOptions);
    },
  };
}
