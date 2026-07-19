import { describe, expect, it, vi } from "vitest";

import { createLibraryService } from "./create-library-service";
import type { LibraryRepositoryPort } from "./library-ports";

const now = new Date("2026-07-19T12:00:00.000Z");
const owned = { actorUserId: "user-a", movieId: "movie-a", ownerUserId: "user-a" } as const;

function dependencies(
  input: Readonly<{
    active?: boolean;
    progress?: "duration-conflict" | "saved" | "stale";
    visible?: boolean;
  }> = {},
) {
  const repository: LibraryRepositoryPort = {
    addToWatchlist: vi.fn(async () => undefined),
    clearAllProgress: vi.fn(async () => undefined),
    clearProgress: vi.fn(async () => undefined),
    getMemberLibrary: vi.fn(async () => ({ continueWatching: [], watchlist: [] })),
    getMovieState: vi.fn(async () => ({
      inWatchlist: false,
      ratingHalfStars: null,
      resumeAtSeconds: 0,
    })),
    getResumePosition: vi.fn(async () => 42),
    removeFromWatchlist: vi.fn(async () => undefined),
    removeRating: vi.fn(async () => undefined),
    saveProgress: vi.fn(async () => input.progress ?? "saved"),
    setRating: vi.fn(async () => undefined),
  };
  return {
    catalogInvalidation: { invalidate: vi.fn() },
    catalogVisibility: { isVisibleMovie: vi.fn(async () => input.visible ?? true) },
    clock: vi.fn(() => now),
    memberAuthorization: { isActiveMember: vi.fn(async () => input.active ?? true) },
    repository,
  };
}

describe("library service", () => {
  it("denies cross-user and inactive-member commands before catalog or writes", async () => {
    const crossUser = dependencies();
    const inactive = dependencies({ active: false });

    await expect(
      createLibraryService(crossUser).addToWatchlist({ ...owned, ownerUserId: "user-b" }),
    ).resolves.toEqual({ kind: "forbidden" });
    await expect(createLibraryService(inactive).addToWatchlist(owned)).resolves.toEqual({
      kind: "forbidden",
    });
    expect(crossUser.catalogVisibility.isVisibleMovie).not.toHaveBeenCalled();
    expect(crossUser.repository.addToWatchlist).not.toHaveBeenCalled();
    expect(inactive.repository.addToWatchlist).not.toHaveBeenCalled();
  });

  it("conceals a non-public movie before writing", async () => {
    const ports = dependencies({ visible: false });

    await expect(
      createLibraryService(ports).setRating({ ...owned, valueHalfStars: 8 }),
    ).resolves.toEqual({ kind: "not-found" });
    expect(ports.repository.setRating).not.toHaveBeenCalled();
  });

  it("allows an active owner to erase rows after a movie becomes non-public", async () => {
    const ports = dependencies({ visible: false });
    const service = createLibraryService(ports);

    await expect(service.removeFromWatchlist(owned)).resolves.toEqual({ kind: "success" });
    await expect(service.removeRating(owned)).resolves.toEqual({ kind: "success" });
    await expect(service.clearProgress(owned)).resolves.toEqual({ kind: "success" });
    expect(ports.catalogVisibility.isVisibleMovie).not.toHaveBeenCalled();
  });

  it("validates rating before authorization and persists valid owned rating", async () => {
    const ports = dependencies();
    const service = createLibraryService(ports);

    await expect(service.setRating({ ...owned, valueHalfStars: 1.5 })).resolves.toEqual({
      kind: "invalid",
    });
    await expect(service.setRating({ ...owned, valueHalfStars: 8 })).resolves.toEqual({
      kind: "success",
    });
    expect(ports.repository.setRating).toHaveBeenCalledWith("user-a", "movie-a", 8, now);
    expect(ports.catalogInvalidation.invalidate).toHaveBeenCalledWith({ movieIds: ["movie-a"] });
  });

  it.each([
    ["saved", "success"],
    ["stale", "stale"],
    ["duration-conflict", "conflict"],
  ] as const)("maps atomic progress result %s", async (progress, kind) => {
    const ports = dependencies({ progress });

    await expect(
      createLibraryService(ports).updateProgress({
        ...owned,
        durationSeconds: 100,
        observedAt: now,
        positionSeconds: 50,
      }),
    ).resolves.toEqual({ kind });
  });

  it("supports idempotent remove/clear commands and safe resume ownership", async () => {
    const ports = dependencies();
    const service = createLibraryService(ports);

    await expect(service.removeFromWatchlist(owned)).resolves.toEqual({ kind: "success" });
    await expect(service.removeRating(owned)).resolves.toEqual({ kind: "success" });
    await expect(service.clearProgress(owned)).resolves.toEqual({ kind: "success" });
    await expect(
      service.clearAllProgress({ actorUserId: "user-a", ownerUserId: "user-a" }),
    ).resolves.toEqual({ kind: "success" });
    await expect(service.getResumePosition(owned)).resolves.toBe(42);
    await expect(service.getResumePosition({ ...owned, ownerUserId: "user-b" })).resolves.toBe(0);
    expect(ports.catalogInvalidation.invalidate).toHaveBeenCalledWith({ movieIds: ["movie-a"] });
  });

  it("returns only an active owner's member and movie read models", async () => {
    const ports = dependencies();
    const service = createLibraryService(ports);

    await expect(
      service.getMemberLibrary({ actorUserId: "user-a", ownerUserId: "user-a" }),
    ).resolves.toEqual({ continueWatching: [], watchlist: [] });
    await expect(service.getMovieState(owned)).resolves.toEqual({
      inWatchlist: false,
      ratingHalfStars: null,
      resumeAtSeconds: 0,
    });
    await expect(
      service.getMemberLibrary({ actorUserId: "user-a", ownerUserId: "user-b" }),
    ).resolves.toBeNull();
    expect(ports.repository.getMemberLibrary).toHaveBeenCalledOnce();
  });
});
