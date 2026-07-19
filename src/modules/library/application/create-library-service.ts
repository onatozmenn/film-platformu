import type { CatalogVisibilityPort } from "@/modules/catalog/application/catalog-visibility-port";
import type { CatalogCacheInvalidator } from "@/modules/catalog/application/catalog-cache-port";
import type { MemberAuthorizationPort } from "@/modules/identity/application/member-authorization-port";

import { evaluateProgress } from "../domain/progress-policy";
import { validateRating } from "../domain/rating-policy";
import type { LibraryRepositoryPort, MemberLibraryView, MemberMovieState } from "./library-ports";

export type LibraryMutationResult =
  | Readonly<{ kind: "conflict" }>
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "invalid" }>
  | Readonly<{ kind: "not-found" }>
  | Readonly<{ kind: "stale" }>
  | Readonly<{ kind: "success" }>;

type OwnedMemberCommand = Readonly<{
  actorUserId: string;
  ownerUserId: string;
}>;

type OwnedCommand = OwnedMemberCommand & Readonly<{ movieId: string }>;

type CreateLibraryServiceDependencies = Readonly<{
  catalogInvalidation: CatalogCacheInvalidator;
  catalogVisibility: CatalogVisibilityPort;
  clock: () => Date;
  memberAuthorization: MemberAuthorizationPort;
  repository: LibraryRepositoryPort;
}>;

export function createLibraryService(dependencies: CreateLibraryServiceDependencies) {
  async function authorizeOwner(
    command: OwnedMemberCommand,
  ): Promise<LibraryMutationResult | null> {
    if (command.actorUserId !== command.ownerUserId) {
      return { kind: "forbidden" };
    }
    if (!(await dependencies.memberAuthorization.isActiveMember(command.actorUserId))) {
      return { kind: "forbidden" };
    }
    return null;
  }

  async function authorize(
    command: OwnedCommand,
    now: Date,
  ): Promise<LibraryMutationResult | null> {
    const ownerDenied = await authorizeOwner(command);
    if (ownerDenied !== null) {
      return ownerDenied;
    }
    if (!(await dependencies.catalogVisibility.isVisibleMovie(command.movieId, now))) {
      return { kind: "not-found" };
    }
    return null;
  }

  return {
    async addToWatchlist(command: OwnedCommand): Promise<LibraryMutationResult> {
      const now = dependencies.clock();
      const denied = await authorize(command, now);
      if (denied !== null) {
        return denied;
      }
      await dependencies.repository.addToWatchlist(command.ownerUserId, command.movieId, now);
      return { kind: "success" };
    },

    async clearProgress(command: OwnedCommand): Promise<LibraryMutationResult> {
      const denied = await authorizeOwner(command);
      if (denied !== null) {
        return denied;
      }
      await dependencies.repository.clearProgress(command.ownerUserId, command.movieId);
      return { kind: "success" };
    },

    async clearAllProgress(command: OwnedMemberCommand): Promise<LibraryMutationResult> {
      const denied = await authorizeOwner(command);
      if (denied !== null) {
        return denied;
      }
      await dependencies.repository.clearAllProgress(command.ownerUserId);
      return { kind: "success" };
    },

    async getMemberLibrary(command: OwnedMemberCommand): Promise<MemberLibraryView | null> {
      const denied = await authorizeOwner(command);
      return denied === null
        ? dependencies.repository.getMemberLibrary(command.ownerUserId, dependencies.clock())
        : null;
    },

    async getMovieState(command: OwnedCommand): Promise<MemberMovieState | null> {
      const denied = await authorizeOwner(command);
      return denied === null
        ? dependencies.repository.getMovieState(command.ownerUserId, command.movieId)
        : null;
    },

    async getResumePosition(command: OwnedCommand): Promise<number> {
      if (command.actorUserId !== command.ownerUserId) {
        return 0;
      }
      if (!(await dependencies.memberAuthorization.isActiveMember(command.actorUserId))) {
        return 0;
      }
      return dependencies.repository.getResumePosition(command.ownerUserId, command.movieId);
    },

    async removeFromWatchlist(command: OwnedCommand): Promise<LibraryMutationResult> {
      const denied = await authorizeOwner(command);
      if (denied !== null) {
        return denied;
      }
      await dependencies.repository.removeFromWatchlist(command.ownerUserId, command.movieId);
      return { kind: "success" };
    },

    async removeRating(command: OwnedCommand): Promise<LibraryMutationResult> {
      const denied = await authorizeOwner(command);
      if (denied !== null) {
        return denied;
      }
      await dependencies.repository.removeRating(command.ownerUserId, command.movieId);
      dependencies.catalogInvalidation.invalidate({ movieIds: [command.movieId] });
      return { kind: "success" };
    },

    async setRating(
      command: OwnedCommand & Readonly<{ valueHalfStars: number }>,
    ): Promise<LibraryMutationResult> {
      const rating = validateRating(command.valueHalfStars);
      if (!rating.accepted) {
        return { kind: "invalid" };
      }
      const now = dependencies.clock();
      const denied = await authorize(command, now);
      if (denied !== null) {
        return denied;
      }
      await dependencies.repository.setRating(
        command.ownerUserId,
        command.movieId,
        rating.valueHalfStars,
        now,
      );
      dependencies.catalogInvalidation.invalidate({ movieIds: [command.movieId] });
      return { kind: "success" };
    },

    async updateProgress(
      command: OwnedCommand &
        Readonly<{ durationSeconds: number; observedAt: Date; positionSeconds: number }>,
    ): Promise<LibraryMutationResult> {
      const now = dependencies.clock();
      const progress = evaluateProgress({
        durationSeconds: command.durationSeconds,
        now,
        observedAt: command.observedAt,
        positionSeconds: command.positionSeconds,
      });
      if (!progress.accepted) {
        return { kind: "invalid" };
      }
      const denied = await authorize(command, now);
      if (denied !== null) {
        return denied;
      }
      const result = await dependencies.repository.saveProgress(
        command.ownerUserId,
        command.movieId,
        progress.value,
        now,
      );
      if (result === "duration-conflict") {
        return { kind: "conflict" };
      }
      return result === "stale" ? { kind: "stale" } : { kind: "success" };
    },
  };
}
