import type {
  CatalogCacheInvalidator,
  CatalogInvalidation,
} from "@/modules/catalog/application/catalog-cache-port";
import {
  MetadataProviderError,
  type MetadataProviderPort,
} from "@/modules/catalog/application/metadata-provider-port";
import {
  VideoProviderError,
  type VideoProviderPort,
} from "@/modules/playback/application/playback-ports";
import type { ActionResult } from "@/shared/application/action-result";

import type {
  AdminCommandRepositoryPort,
  AttachVideoAssetCommand,
  ChangeRoleCommand,
  CollectionMutationView,
  ContentRightMutationView,
  CreateMovieDraftCommand,
  DisableAccountCommand,
  ImportMovieDraftCommand,
  MovieMutationView,
  PublishDueResult,
  PublishMovieCommand,
  ResolvedVideoAssetCommand,
  ReturnMovieToDraftCommand,
  ScheduleMovieCommand,
  SetContentRightCommand,
  SetMovieCreditsCommand,
  SetSubtitleTracksCommand,
  UnpublishMovieCommand,
  UpdateMovieEditorialDataCommand,
  UpsertCollectionCommand,
  VideoAssetMutationView,
} from "./admin-command-port";

type AdminCommandServiceDependencies = Readonly<{
  catalogInvalidation: CatalogCacheInvalidator;
  clock: () => Date;
  metadataProvider: MetadataProviderPort;
  publicationBatchLimit: number;
  reportInvalidationFailure: () => void;
  repository: AdminCommandRepositoryPort;
  videoProvider: VideoProviderPort;
}>;

export function createAdminCommandService(dependencies: AdminCommandServiceDependencies) {
  function invalidate(input: CatalogInvalidation): void {
    try {
      dependencies.catalogInvalidation.invalidate(input);
    } catch {
      dependencies.reportInvalidationFailure();
    }
  }

  async function afterCommit<T>(
    operation: () => Promise<ActionResult<T>>,
    invalidation: (data: T) => CatalogInvalidation,
  ): Promise<ActionResult<T>> {
    const result = await operation();
    if (result.ok) {
      invalidate(invalidation(result.data));
    }
    return result;
  }

  function immediate(input: CatalogInvalidation): CatalogInvalidation {
    return { ...input, expireImmediately: true };
  }

  async function resolveVideoAsset(
    command: AttachVideoAssetCommand,
  ): Promise<ActionResult<ResolvedVideoAssetCommand>> {
    try {
      const providerAsset = await dependencies.videoProvider.getAsset(command.providerAssetId);
      if (providerAsset === null || providerAsset.providerAssetId !== command.providerAssetId) {
        return {
          code: "NOT_FOUND",
          fieldErrors: { providerAssetId: ["Video varlığı bulunamadı."] },
          ok: false,
        };
      }
      return { data: { ...command, providerAsset }, ok: true };
    } catch (error) {
      if (error instanceof VideoProviderError) {
        return { code: "PROVIDER_UNAVAILABLE", ok: false };
      }
      throw error;
    }
  }

  async function mutateVideoAsset(
    command: AttachVideoAssetCommand,
    operation: (
      resolved: ResolvedVideoAssetCommand,
    ) => Promise<ActionResult<VideoAssetMutationView>>,
  ): Promise<ActionResult<VideoAssetMutationView>> {
    const resolved = await resolveVideoAsset(command);
    if (!resolved.ok) {
      return resolved;
    }
    return afterCommit(
      () => operation(resolved.data),
      (data) => immediate({ movieIds: [data.movieId] }),
    );
  }

  return {
    attachVideoAsset(
      command: AttachVideoAssetCommand,
    ): Promise<ActionResult<VideoAssetMutationView>> {
      return mutateVideoAsset(command, dependencies.repository.attachVideoAsset);
    },

    createMovieDraft(command: CreateMovieDraftCommand): Promise<ActionResult<MovieMutationView>> {
      return dependencies.repository.createMovieDraft(command);
    },

    disableAccount(
      command: DisableAccountCommand,
    ): Promise<ActionResult<Readonly<{ userId: string }>>> {
      return afterCommit(
        () => dependencies.repository.disableAccount(command),
        () => immediate({}),
      );
    },

    grantRole(command: ChangeRoleCommand): Promise<ActionResult<Readonly<{ userId: string }>>> {
      return dependencies.repository.grantRole(command);
    },

    async importMovieDraft(
      command: Omit<ImportMovieDraftCommand, "metadata">,
    ): Promise<ActionResult<MovieMutationView>> {
      try {
        const metadata = await dependencies.metadataProvider.getMovie(command.externalId);
        if (metadata === null) {
          return { code: "NOT_FOUND", ok: false };
        }
        return dependencies.repository.importMovieDraft({ ...command, metadata });
      } catch (error) {
        if (error instanceof MetadataProviderError) {
          return error.code === "invalid-request"
            ? { code: "INVALID_INPUT", ok: false }
            : { code: "PROVIDER_UNAVAILABLE", ok: false };
        }
        throw error;
      }
    },

    async publishDue(requestId: string): Promise<PublishDueResult> {
      const result = await dependencies.repository.publishDue(
        dependencies.clock(),
        dependencies.publicationBatchLimit,
        requestId,
      );
      if (result.publishedMovies.length > 0) {
        invalidate({
          expireImmediately: true,
          movieIds: result.publishedMovies.map(({ id }) => id),
          movieSlugs: result.publishedMovies.map(({ slug }) => slug),
          searchChanged: true,
        });
      }
      return {
        examined: result.examined,
        failed: result.failed,
        published: result.publishedMovies.length,
        skipped: result.skipped,
      };
    },

    publishMovie(command: PublishMovieCommand): Promise<ActionResult<MovieMutationView>> {
      return afterCommit(
        () => dependencies.repository.publishMovie(command),
        (data) => immediate({ movieIds: [data.id], movieSlugs: [data.slug], searchChanged: true }),
      );
    },

    reconcileVideoAsset(
      command: AttachVideoAssetCommand,
    ): Promise<ActionResult<VideoAssetMutationView>> {
      return mutateVideoAsset(command, dependencies.repository.reconcileVideoAsset);
    },

    returnMovieToDraft(
      command: ReturnMovieToDraftCommand,
    ): Promise<ActionResult<MovieMutationView>> {
      return afterCommit(
        () => dependencies.repository.returnMovieToDraft(command),
        (data) => immediate({ movieIds: [data.id], movieSlugs: [data.slug], searchChanged: true }),
      );
    },

    revokeRole(command: ChangeRoleCommand): Promise<ActionResult<Readonly<{ userId: string }>>> {
      return dependencies.repository.revokeRole(command);
    },

    scheduleMovie(command: ScheduleMovieCommand): Promise<ActionResult<MovieMutationView>> {
      return afterCommit(
        () => dependencies.repository.scheduleMovie(command),
        (data) => immediate({ movieIds: [data.id], movieSlugs: [data.slug], searchChanged: true }),
      );
    },

    setContentRight(
      command: SetContentRightCommand,
    ): Promise<ActionResult<ContentRightMutationView>> {
      return afterCommit(
        () => dependencies.repository.setContentRight(command),
        (data) => immediate({ movieIds: [data.movieId] }),
      );
    },

    setMovieCredits(command: SetMovieCreditsCommand): Promise<ActionResult<MovieMutationView>> {
      return afterCommit(
        () => dependencies.repository.setMovieCredits(command),
        (data) => immediate({ movieIds: [data.id], movieSlugs: [data.slug], searchChanged: true }),
      );
    },

    setSubtitleTracks(
      command: SetSubtitleTracksCommand,
    ): Promise<ActionResult<VideoAssetMutationView>> {
      return afterCommit(
        () => dependencies.repository.setSubtitleTracks(command),
        (data) => immediate({ movieIds: [data.movieId] }),
      );
    },

    unpublishMovie(command: UnpublishMovieCommand): Promise<ActionResult<MovieMutationView>> {
      return afterCommit(
        () => dependencies.repository.unpublishMovie(command),
        (data) => immediate({ movieIds: [data.id], movieSlugs: [data.slug], searchChanged: true }),
      );
    },

    updateMovieEditorialData(
      command: UpdateMovieEditorialDataCommand,
    ): Promise<ActionResult<MovieMutationView>> {
      return afterCommit(
        () => dependencies.repository.updateMovieEditorialData(command),
        (data) => immediate({ movieIds: [data.id], movieSlugs: [data.slug], searchChanged: true }),
      );
    },

    upsertCollection(
      command: UpsertCollectionCommand,
    ): Promise<ActionResult<CollectionMutationView>> {
      return afterCommit(
        () => dependencies.repository.upsertCollection(command),
        () => immediate({ collectionChanged: true }),
      );
    },
  };
}
