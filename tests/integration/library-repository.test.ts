import type { PrismaClient } from "@/generated/prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createPrismaCatalogVisibility } from "@/modules/catalog/infrastructure/prisma-catalog-visibility";
import { createPrismaMemberAuthorization } from "@/modules/identity/infrastructure/prisma-member-authorization";
import { createLibraryService } from "@/modules/library/application/create-library-service";
import { createPrismaLibraryRepository } from "@/modules/library/infrastructure/prisma-library-repository";
import { createDatabaseClient } from "@/shared/db/client-factory";

const localTestDatabaseUrl =
  "postgresql://film:film@127.0.0.1:54329/film_platform_test?schema=public";
const fixedNow = new Date("2026-07-19T12:10:00.000Z");
const fixtureEmails = [
  "library-owner@film-platform.invalid",
  "library-other@film-platform.invalid",
  "library-no-role@film-platform.invalid",
] as const;

function resolveTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL ?? localTestDatabaseUrl;
  if (!new URL(value).pathname.slice(1).endsWith("_test")) {
    throw new Error("Library integration tests require a database name ending in _test");
  }
  return value;
}

describe("Prisma member library", () => {
  let client: PrismaClient;
  let ownerId: string;
  let otherId: string;
  let noRoleId: string;
  let visibleMovieId: string;
  let hiddenMovieId: string;
  let repository: ReturnType<typeof createPrismaLibraryRepository>;
  let service: ReturnType<typeof createLibraryService>;

  beforeAll(async () => {
    client = createDatabaseClient(resolveTestDatabaseUrl());
    await client.user.deleteMany({ where: { email: { in: [...fixtureEmails] } } });
    const [owner, other, noRole, visibleMovie, hiddenMovie] = await Promise.all([
      client.user.create({
        data: {
          email: fixtureEmails[0],
          profile: { create: { displayName: "Kütüphane Sahibi" } },
          roles: { create: { role: "MEMBER" } },
        },
      }),
      client.user.create({
        data: {
          email: fixtureEmails[1],
          profile: { create: { displayName: "Başka Üye" } },
          roles: { create: { role: "MEMBER" } },
        },
      }),
      client.user.create({
        data: {
          email: fixtureEmails[2],
          profile: { create: { displayName: "Yetkisiz Profil" } },
        },
      }),
      client.movie.findUniqueOrThrow({ where: { slug: "kiyidaki-sessizlik" } }),
      client.movie.findUniqueOrThrow({ where: { slug: "kurgu-masasinda" } }),
    ]);
    ownerId = owner.id;
    otherId = other.id;
    noRoleId = noRole.id;
    visibleMovieId = visibleMovie.id;
    hiddenMovieId = hiddenMovie.id;
    repository = createPrismaLibraryRepository(client);
    service = createLibraryService({
      catalogInvalidation: { invalidate: () => undefined },
      catalogVisibility: createPrismaCatalogVisibility(client),
      clock: () => fixedNow,
      memberAuthorization: createPrismaMemberAuthorization(client),
      repository,
    });
  });

  beforeEach(async () => {
    await client.watchProgress.deleteMany({ where: { userId: { in: [ownerId, otherId] } } });
    await client.rating.deleteMany({ where: { userId: { in: [ownerId, otherId] } } });
    await client.watchlistEntry.deleteMany({ where: { userId: { in: [ownerId, otherId] } } });
  });

  afterAll(async () => {
    await client.user.deleteMany({ where: { email: { in: [...fixtureEmails] } } });
    await client.$disconnect();
  });

  it("requires an active profile with an explicit MEMBER capability", async () => {
    const authorization = createPrismaMemberAuthorization(client);

    await expect(authorization.isActiveMember(ownerId)).resolves.toBe(true);
    await expect(authorization.isActiveMember(noRoleId)).resolves.toBe(false);
    await client.userProfile.update({
      where: { userId: ownerId },
      data: { disabledAt: fixedNow },
    });
    await expect(authorization.isActiveMember(ownerId)).resolves.toBe(false);
    await client.userProfile.update({
      where: { userId: ownerId },
      data: { disabledAt: null },
    });
  });

  it("denies cross-user commands and conceals non-public films before persistence", async () => {
    await expect(
      service.addToWatchlist({
        actorUserId: otherId,
        movieId: visibleMovieId,
        ownerUserId: ownerId,
      }),
    ).resolves.toEqual({ kind: "forbidden" });
    await expect(
      service.addToWatchlist({
        actorUserId: ownerId,
        movieId: hiddenMovieId,
        ownerUserId: ownerId,
      }),
    ).resolves.toEqual({ kind: "not-found" });
    await expect(client.watchlistEntry.count({ where: { userId: ownerId } })).resolves.toBe(0);
  });

  it("adds, updates, and removes watchlist and rating rows idempotently", async () => {
    const command = { actorUserId: ownerId, movieId: visibleMovieId, ownerUserId: ownerId };

    await expect(service.addToWatchlist(command)).resolves.toEqual({ kind: "success" });
    await expect(service.addToWatchlist(command)).resolves.toEqual({ kind: "success" });
    await expect(
      client.watchlistEntry.count({ where: { movieId: visibleMovieId, userId: ownerId } }),
    ).resolves.toBe(1);
    await expect(service.removeFromWatchlist(command)).resolves.toEqual({ kind: "success" });
    await expect(service.removeFromWatchlist(command)).resolves.toEqual({ kind: "success" });

    await expect(service.setRating({ ...command, valueHalfStars: 6 })).resolves.toEqual({
      kind: "success",
    });
    await expect(service.setRating({ ...command, valueHalfStars: 9 })).resolves.toEqual({
      kind: "success",
    });
    await expect(
      client.rating.findUnique({
        where: { userId_movieId: { movieId: visibleMovieId, userId: ownerId } },
      }),
    ).resolves.toMatchObject({ valueHalfStars: 9 });
    await expect(service.removeRating(command)).resolves.toEqual({ kind: "success" });
    await expect(service.removeRating(command)).resolves.toEqual({ kind: "success" });
  });

  it("keeps the newest compatible progress under races and rejects duration drift", async () => {
    const base = { actorUserId: ownerId, movieId: visibleMovieId, ownerUserId: ownerId };
    const earlier = new Date("2026-07-19T12:01:00.000Z");
    const later = new Date("2026-07-19T12:02:00.000Z");

    await Promise.all([
      service.updateProgress({
        ...base,
        durationSeconds: 100,
        observedAt: later,
        positionSeconds: 80,
      }),
      service.updateProgress({
        ...base,
        durationSeconds: 100,
        observedAt: earlier,
        positionSeconds: 60,
      }),
    ]);
    await expect(
      client.watchProgress.findUniqueOrThrow({
        where: { userId_movieId: { movieId: visibleMovieId, userId: ownerId } },
      }),
    ).resolves.toMatchObject({ observedAt: later, positionSeconds: 80 });

    await expect(
      service.updateProgress({
        ...base,
        durationSeconds: 106,
        observedAt: new Date("2026-07-19T12:03:00.000Z"),
        positionSeconds: 90,
      }),
    ).resolves.toEqual({ kind: "conflict" });
    await expect(
      service.updateProgress({
        ...base,
        durationSeconds: 105,
        observedAt: new Date("2026-07-19T12:04:00.000Z"),
        positionSeconds: 99.75,
      }),
    ).resolves.toEqual({ kind: "success" });
    await expect(
      client.watchProgress.findUniqueOrThrow({
        where: { userId_movieId: { movieId: visibleMovieId, userId: ownerId } },
      }),
    ).resolves.toMatchObject({ completed: true, durationSeconds: 105, positionSeconds: 99.75 });
    await expect(service.getResumePosition(base)).resolves.toBe(0);
    await expect(service.clearProgress(base)).resolves.toEqual({ kind: "success" });
    await expect(service.clearProgress(base)).resolves.toEqual({ kind: "success" });
  });

  it("projects only visible member rows while clearing all owned history", async () => {
    const command = { actorUserId: ownerId, movieId: visibleMovieId, ownerUserId: ownerId };
    const observedAt = new Date("2026-07-19T12:05:00.000Z");

    await service.addToWatchlist(command);
    await service.setRating({ ...command, valueHalfStars: 7 });
    await service.updateProgress({
      ...command,
      durationSeconds: 100,
      observedAt,
      positionSeconds: 40,
    });
    await client.watchlistEntry.create({
      data: { createdAt: observedAt, movieId: hiddenMovieId, userId: ownerId },
    });
    await client.watchProgress.create({
      data: {
        completed: false,
        durationSeconds: 100,
        lastWatchedAt: observedAt,
        movieId: hiddenMovieId,
        observedAt,
        positionSeconds: 20,
        userId: ownerId,
      },
    });
    await client.rating.create({
      data: { movieId: hiddenMovieId, userId: ownerId, valueHalfStars: 8 },
    });

    await expect(
      service.getMemberLibrary({ actorUserId: ownerId, ownerUserId: ownerId }),
    ).resolves.toMatchObject({
      continueWatching: [
        { movie: { id: visibleMovieId, slug: "kiyidaki-sessizlik" }, progressPercent: 40 },
      ],
      watchlist: [{ id: visibleMovieId, slug: "kiyidaki-sessizlik" }],
    });
    await expect(service.getMovieState(command)).resolves.toEqual({
      inWatchlist: true,
      ratingHalfStars: 7,
      resumeAtSeconds: 40,
    });
    await expect(
      service.getMemberLibrary({ actorUserId: otherId, ownerUserId: ownerId }),
    ).resolves.toBeNull();

    const hiddenCommand = {
      actorUserId: ownerId,
      movieId: hiddenMovieId,
      ownerUserId: ownerId,
    };
    await expect(service.removeFromWatchlist(hiddenCommand)).resolves.toEqual({ kind: "success" });
    await expect(service.removeRating(hiddenCommand)).resolves.toEqual({ kind: "success" });
    await expect(service.clearProgress(hiddenCommand)).resolves.toEqual({ kind: "success" });
    await expect(
      client.watchlistEntry.count({ where: { movieId: hiddenMovieId, userId: ownerId } }),
    ).resolves.toBe(0);
    await expect(
      client.rating.count({ where: { movieId: hiddenMovieId, userId: ownerId } }),
    ).resolves.toBe(0);
    await expect(
      client.watchProgress.count({ where: { movieId: hiddenMovieId, userId: ownerId } }),
    ).resolves.toBe(0);

    await client.watchProgress.create({
      data: {
        completed: false,
        durationSeconds: 100,
        lastWatchedAt: observedAt,
        movieId: hiddenMovieId,
        observedAt,
        positionSeconds: 20,
        userId: ownerId,
      },
    });

    await expect(
      service.clearAllProgress({ actorUserId: ownerId, ownerUserId: ownerId }),
    ).resolves.toEqual({ kind: "success" });
    await expect(client.watchProgress.count({ where: { userId: ownerId } })).resolves.toBe(0);
  });
});
