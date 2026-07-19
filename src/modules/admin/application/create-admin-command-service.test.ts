import { describe, expect, it, vi } from "vitest";

import {
  MetadataProviderError,
  type MetadataMovie,
  type MetadataProviderPort,
} from "@/modules/catalog/application/metadata-provider-port";
import {
  VideoProviderError,
  type VideoProviderPort,
} from "@/modules/playback/application/playback-ports";

import type {
  AdminCommandRepositoryPort,
  AttachVideoAssetCommand,
  UpdateMovieEditorialDataCommand,
} from "./admin-command-port";
import { createAdminCommandService } from "./create-admin-command-service";

const movie = { id: "movie-id", revision: 2, slug: "kiyidaki-sessizlik" } as const;
const asset = { assetId: "asset-id", movieId: movie.id, state: "READY" } as const;
const metadata: MetadataMovie = {
  backdropPath: "/backdrop.jpg",
  credits: [],
  externalId: "42",
  genres: [{ externalId: "18", name: "Dram" }],
  originalTitle: "Imported Movie",
  posterPath: "/poster.jpg",
  provider: "TMDB",
  releaseDate: "2026-01-01",
  runtimeMinutes: 98,
  synopsis: "Yeterince uzun sağlayıcı film özeti.",
  title: "İçe Aktarılan Film",
};
const updateCommand: UpdateMovieEditorialDataCommand = {
  actorUserId: "editor-id",
  ageRating: "13+",
  backdrop: null,
  expectedRevision: 1,
  genreIds: ["genre-id"],
  movieId: movie.id,
  originalTitle: null,
  poster: null,
  releaseDate: new Date("2026-01-01T00:00:00.000Z"),
  requestId: "req-update",
  runtimeMinutes: 98,
  slug: movie.slug,
  synopsis: "Yeterince uzun kurgusal film özeti.",
  title: "Kıyıdaki Sessizlik",
};
const assetCommand: AttachVideoAssetCommand = {
  actorUserId: "admin-id",
  makeActive: true,
  movieId: movie.id,
  providerAssetId: "fake-asset-admin-ready",
  requestId: "req-asset",
};

function createRepository() {
  return {
    attachVideoAsset: vi.fn(async () => ({ data: asset, ok: true }) as const),
    createMovieDraft: vi.fn(async () => ({ data: movie, ok: true }) as const),
    disableAccount: vi.fn(async () => ({ data: { userId: "member-id" }, ok: true }) as const),
    grantRole: vi.fn(async () => ({ data: { userId: "member-id" }, ok: true }) as const),
    importMovieDraft: vi.fn(async () => ({ data: movie, ok: true }) as const),
    publishDue: vi.fn<AdminCommandRepositoryPort["publishDue"]>(async () => ({
      examined: 0,
      failed: 0,
      publishedMovies: [],
      skipped: 0,
    })),
    publishMovie: vi.fn(async () => ({ data: movie, ok: true }) as const),
    reconcileVideoAsset: vi.fn(async () => ({ data: asset, ok: true }) as const),
    returnMovieToDraft: vi.fn(async () => ({ data: movie, ok: true }) as const),
    revokeRole: vi.fn(async () => ({ data: { userId: "member-id" }, ok: true }) as const),
    scheduleMovie: vi.fn(async () => ({ data: movie, ok: true }) as const),
    setContentRight: vi.fn(
      async () =>
        ({
          data: { movieId: movie.id, rightId: "right-id" },
          ok: true,
        }) as const,
    ),
    setMovieCredits: vi.fn(async () => ({ data: movie, ok: true }) as const),
    setSubtitleTracks: vi.fn(async () => ({ data: asset, ok: true }) as const),
    unpublishMovie: vi.fn(async () => ({ data: movie, ok: true }) as const),
    updateMovieEditorialData: vi.fn<AdminCommandRepositoryPort["updateMovieEditorialData"]>(
      async () => ({ data: movie, ok: true }),
    ),
    upsertCollection: vi.fn(
      async () =>
        ({
          data: { id: "collection-id", revision: 2, slug: "editorun-seckisi" },
          ok: true,
        }) as const,
    ),
  } satisfies AdminCommandRepositoryPort;
}

function createVideoProvider() {
  return {
    createPlaybackGrant: vi.fn(async () => ({ token: "unused" })),
    getAsset: vi.fn<VideoProviderPort["getAsset"]>(async (providerAssetId: string) => ({
      durationSeconds: 6,
      playbackId: "fake-playback-admin-ready",
      providerAssetId,
      state: "READY" as const,
    })),
    verifyWebhook: vi.fn(async () => ({
      durationSeconds: null,
      eventId: "unused",
      eventType: "ASSET_DELETED" as const,
      playbackId: null,
      providerAssetId: "unused",
    })),
  } satisfies VideoProviderPort;
}

function createMetadataProvider() {
  return {
    getMovie: vi.fn<MetadataProviderPort["getMovie"]>(async () => metadata),
    searchMovies: vi.fn(async () => []),
  } satisfies MetadataProviderPort;
}

function dependencies() {
  const repository = createRepository();
  const videoProvider = createVideoProvider();
  const metadataProvider = createMetadataProvider();
  const invalidate = vi.fn();
  const reportInvalidationFailure = vi.fn();
  const service = createAdminCommandService({
    catalogInvalidation: { invalidate },
    clock: () => new Date("2026-07-19T12:00:00.000Z"),
    metadataProvider,
    publicationBatchLimit: 25,
    reportInvalidationFailure,
    repository,
    videoProvider,
  });
  return {
    invalidate,
    metadataProvider,
    reportInvalidationFailure,
    repository,
    service,
    videoProvider,
  };
}

describe("admin command service", () => {
  it("resolves allowed metadata before the atomic import command", async () => {
    const ports = dependencies();
    const command = { actorUserId: "editor-id", externalId: "42", requestId: "req-import" };

    await expect(ports.service.importMovieDraft(command)).resolves.toEqual({
      data: movie,
      ok: true,
    });
    expect(ports.metadataProvider.getMovie).toHaveBeenCalledWith("42");
    expect(ports.repository.importMovieDraft).toHaveBeenCalledWith({ ...command, metadata });

    ports.metadataProvider.getMovie.mockResolvedValueOnce(null);
    await expect(ports.service.importMovieDraft(command)).resolves.toEqual({
      code: "NOT_FOUND",
      ok: false,
    });
  });

  it("maps metadata provider failures without concealing programming errors", async () => {
    const invalid = dependencies();
    invalid.metadataProvider.getMovie.mockRejectedValueOnce(
      new MetadataProviderError("invalid-request", "invalid"),
    );
    await expect(
      invalid.service.importMovieDraft({
        actorUserId: "editor-id",
        externalId: "invalid",
        requestId: "req-invalid-import",
      }),
    ).resolves.toEqual({ code: "INVALID_INPUT", ok: false });

    const unavailable = dependencies();
    unavailable.metadataProvider.getMovie.mockRejectedValueOnce(
      new MetadataProviderError("unavailable", "unavailable"),
    );
    await expect(
      unavailable.service.importMovieDraft({
        actorUserId: "editor-id",
        externalId: "42",
        requestId: "req-unavailable-import",
      }),
    ).resolves.toEqual({ code: "PROVIDER_UNAVAILABLE", ok: false });

    const unexpected = dependencies();
    unexpected.metadataProvider.getMovie.mockRejectedValueOnce(new Error("unexpected"));
    await expect(
      unexpected.service.importMovieDraft({
        actorUserId: "editor-id",
        externalId: "42",
        requestId: "req-unexpected-import",
      }),
    ).rejects.toThrow("unexpected");
  });

  it("invalidates public movie and search tags only after a committed editorial update", async () => {
    const success = dependencies();

    await expect(success.service.updateMovieEditorialData(updateCommand)).resolves.toEqual({
      data: movie,
      ok: true,
    });
    expect(success.invalidate).toHaveBeenCalledWith({
      expireImmediately: true,
      movieIds: [movie.id],
      movieSlugs: [movie.slug],
      searchChanged: true,
    });

    const denied = dependencies();
    denied.repository.updateMovieEditorialData.mockResolvedValueOnce({
      code: "FORBIDDEN",
      ok: false,
    });
    await expect(denied.service.updateMovieEditorialData(updateCommand)).resolves.toEqual({
      code: "FORBIDDEN",
      ok: false,
    });
    expect(denied.invalidate).not.toHaveBeenCalled();
  });

  it("resolves a provider asset before committing and invalidates only afterward", async () => {
    const ports = dependencies();

    await expect(ports.service.attachVideoAsset(assetCommand)).resolves.toEqual({
      data: asset,
      ok: true,
    });
    expect(ports.videoProvider.getAsset).toHaveBeenCalledWith(assetCommand.providerAssetId);
    expect(ports.repository.attachVideoAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        providerAsset: expect.objectContaining({ providerAssetId: assetCommand.providerAssetId }),
      }),
    );
    expect(ports.invalidate).toHaveBeenCalledWith({
      expireImmediately: true,
      movieIds: [movie.id],
    });
  });

  it("maps missing, mismatched, and owned provider failures without starting a transaction", async () => {
    const missing = dependencies();
    missing.videoProvider.getAsset.mockResolvedValueOnce(null);
    await expect(missing.service.attachVideoAsset(assetCommand)).resolves.toMatchObject({
      code: "NOT_FOUND",
      ok: false,
    });
    expect(missing.repository.attachVideoAsset).not.toHaveBeenCalled();

    const mismatched = dependencies();
    mismatched.videoProvider.getAsset.mockResolvedValueOnce({
      durationSeconds: 6,
      playbackId: "playback-id",
      providerAssetId: "different-id",
      state: "READY",
    });
    await expect(mismatched.service.reconcileVideoAsset(assetCommand)).resolves.toMatchObject({
      code: "NOT_FOUND",
      ok: false,
    });
    expect(mismatched.repository.reconcileVideoAsset).not.toHaveBeenCalled();

    const unavailable = dependencies();
    unavailable.videoProvider.getAsset.mockRejectedValueOnce(new VideoProviderError("UNAVAILABLE"));
    await expect(unavailable.service.attachVideoAsset(assetCommand)).resolves.toEqual({
      code: "PROVIDER_UNAVAILABLE",
      ok: false,
    });
    expect(unavailable.repository.attachVideoAsset).not.toHaveBeenCalled();
  });

  it("does not conceal an unexpected provider programming failure", async () => {
    const ports = dependencies();
    ports.videoProvider.getAsset.mockRejectedValueOnce(new Error("unexpected"));

    await expect(ports.service.attachVideoAsset(assetCommand)).rejects.toThrow("unexpected");
  });

  it("preserves committed success when cache invalidation fails and reports coarsely", async () => {
    const ports = dependencies();
    ports.invalidate.mockImplementationOnce(() => {
      throw new Error("cache unavailable");
    });

    await expect(
      ports.service.publishMovie({
        actorUserId: "editor-id",
        expectedRevision: 1,
        movieId: movie.id,
        requestId: "req-publish",
      }),
    ).resolves.toEqual({ data: movie, ok: true });
    expect(ports.reportInvalidationFailure).toHaveBeenCalledOnce();
  });

  it("uses one server clock and bounded batch while returning aggregate due-publication facts", async () => {
    const ports = dependencies();
    ports.repository.publishDue.mockResolvedValueOnce({
      examined: 3,
      failed: 1,
      publishedMovies: [{ id: movie.id, slug: movie.slug }],
      skipped: 1,
    });

    await expect(ports.service.publishDue("req-cron")).resolves.toEqual({
      examined: 3,
      failed: 1,
      published: 1,
      skipped: 1,
    });
    expect(ports.repository.publishDue).toHaveBeenCalledWith(
      new Date("2026-07-19T12:00:00.000Z"),
      25,
      "req-cron",
    );
    expect(ports.invalidate).toHaveBeenCalledWith({
      expireImmediately: true,
      movieIds: [movie.id],
      movieSlugs: [movie.slug],
      searchChanged: true,
    });

    const empty = dependencies();
    await empty.service.publishDue("req-empty");
    expect(empty.invalidate).not.toHaveBeenCalled();
  });
});
