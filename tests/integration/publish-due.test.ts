import type { PrismaClient } from "@/generated/prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createPrismaPublishDue } from "@/modules/admin/infrastructure/prisma-publish-due";
import { createDatabaseClient } from "@/shared/db/client-factory";

const localTestDatabaseUrl =
  "postgresql://film:film@127.0.0.1:54329/film_platform_test?schema=public";
const now = new Date("2026-07-19T12:00:00.000Z");

function resolveTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL ?? localTestDatabaseUrl;
  if (!new URL(value).pathname.slice(1).endsWith("_test")) {
    throw new Error("Scheduled publication tests require a database name ending in _test");
  }
  return value;
}

async function cleanFixtures(client: PrismaClient): Promise<void> {
  await client.$executeRaw`TRUNCATE TABLE "audit_events"`;
  await client.movie.deleteMany({ where: { slug: { startsWith: "admin-due-" } } });
}

async function createScheduledMovie(
  client: PrismaClient,
  slug: string,
  publishAt: Date,
  options: Readonly<{ ready?: boolean; rights?: boolean }> = {},
) {
  const genre = await client.genre.findUniqueOrThrow({ where: { slug: "dram" } });
  const movie = await client.movie.create({
    data: {
      backdropAlt: "Kurgusal zamanlanmış film fonu",
      backdropFocalPosition: "50% 50%",
      backdropHeight: 1_200,
      backdropSrc: "/fixtures/catalog/theater-interior.jpg",
      backdropWidth: 1_800,
      genres: { create: [{ genreId: genre.id }] },
      posterAlt: "Kurgusal zamanlanmış film afişi",
      posterFocalPosition: "50% 50%",
      posterHeight: 1_200,
      posterSrc: "/fixtures/catalog/fog-coast.jpg",
      posterWidth: 800,
      publicationState: "SCHEDULED",
      publishAt,
      releaseDate: new Date("2026-01-01T00:00:00.000Z"),
      runtimeMinutes: 98,
      slug,
      synopsis: "Zamanlanmış yayın komutunu doğrulayan yeterince uzun kurgusal film özeti.",
      title: "Zamanlanmış Yayın Filmi",
      titleSearch: "zamanlanmis yayin filmi",
    },
  });
  if (options.ready !== false) {
    await client.videoAsset.create({
      data: {
        durationSeconds: 5_880,
        isActive: true,
        movieId: movie.id,
        provider: "MUX",
        providerAssetId: `fake-asset-${slug}`,
        providerPlaybackId: `fake-playback-${slug}`,
        state: "READY",
      },
    });
  }
  if (options.rights !== false) {
    await client.contentRight.create({
      data: {
        allowStreaming: true,
        endsAt: new Date("2026-08-01T00:00:00.000Z"),
        evidenceReference: `fixture-license:${slug}`,
        movieId: movie.id,
        startsAt: new Date("2026-07-01T00:00:00.000Z"),
        territory: "TR",
      },
    });
  }
  return movie;
}

describe("scheduled publication", () => {
  let client: PrismaClient;

  beforeAll(() => {
    client = createDatabaseClient(resolveTestDatabaseUrl());
  });

  beforeEach(async () => {
    await cleanFixtures(client);
  });

  afterEach(async () => {
    await cleanFixtures(client);
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  it("publishes exact-due content once, leaves early content, and records retryable validation failure", async () => {
    const exactDue = await createScheduledMovie(client, "admin-due-exact", now);
    const early = await createScheduledMovie(
      client,
      "admin-due-early",
      new Date("2026-07-19T12:00:00.001Z"),
    );
    const invalid = await createScheduledMovie(client, "admin-due-invalid", now, {
      rights: false,
    });
    const repository = createPrismaPublishDue(client, { supportedTerritories: ["TR"] });

    await expect(repository.publishDue(now, 10, "req_publish_due_first")).resolves.toEqual({
      examined: 2,
      failed: 1,
      publishedMovies: [{ id: exactDue.id, slug: exactDue.slug }],
      skipped: 0,
    });
    await expect(
      client.movie.findUniqueOrThrow({ where: { id: exactDue.id } }),
    ).resolves.toMatchObject({
      firstPublishedAt: now,
      publicationState: "PUBLISHED",
      publishAt: null,
      revision: 2,
    });
    await expect(
      client.movie.findUniqueOrThrow({ where: { id: early.id } }),
    ).resolves.toMatchObject({ publicationState: "SCHEDULED", revision: 1 });
    await expect(
      client.movie.findUniqueOrThrow({ where: { id: invalid.id } }),
    ).resolves.toMatchObject({
      lastPublishAttemptAt: now,
      lastPublishFailure: "RIGHTS_UNAVAILABLE",
      publicationState: "SCHEDULED",
      revision: 2,
    });
    await expect(repository.publishDue(now, 10, "req_publish_due_duplicate")).resolves.toEqual({
      examined: 0,
      failed: 0,
      publishedMovies: [],
      skipped: 0,
    });

    const audits = await client.auditEvent.findMany({
      orderBy: { action: "asc" },
      select: { action: true, actorType: true, actorUserId: true, metadata: true },
      where: { targetId: { in: [exactDue.id, invalid.id] } },
    });
    expect(audits).toEqual([
      {
        action: "MOVIE_PUBLICATION_FAILED",
        actorType: "SYSTEM",
        actorUserId: null,
        metadata: { failureCode: "RIGHTS_UNAVAILABLE", issueCodes: ["RIGHTS_UNAVAILABLE"] },
      },
      {
        action: "MOVIE_PUBLISHED",
        actorType: "SYSTEM",
        actorUserId: null,
        metadata: { source: "SCHEDULED" },
      },
    ]);
  });

  it("retries a failed row on a later run after its current policy becomes valid", async () => {
    const movie = await createScheduledMovie(client, "admin-due-retry", now, { rights: false });
    const repository = createPrismaPublishDue(client, { supportedTerritories: ["TR"] });

    await expect(repository.publishDue(now, 10, "req_publish_due_invalid")).resolves.toMatchObject({
      failed: 1,
      publishedMovies: [],
    });
    await client.contentRight.create({
      data: {
        allowStreaming: true,
        endsAt: new Date("2026-08-01T00:00:00.000Z"),
        evidenceReference: "fixture-license:admin-due-retry",
        movieId: movie.id,
        startsAt: new Date("2026-07-01T00:00:00.000Z"),
        territory: "TR",
      },
    });
    const retryAt = new Date(now.getTime() + 1);

    await expect(repository.publishDue(retryAt, 10, "req_publish_due_retry")).resolves.toEqual({
      examined: 1,
      failed: 0,
      publishedMovies: [{ id: movie.id, slug: movie.slug }],
      skipped: 0,
    });
    await expect(
      client.movie.findUniqueOrThrow({ where: { id: movie.id } }),
    ).resolves.toMatchObject({
      lastPublishAttemptAt: null,
      lastPublishFailure: null,
      publicationState: "PUBLISHED",
      revision: 3,
    });
  });

  it("allows overlapping invocations to publish an eligible row only once", async () => {
    const movie = await createScheduledMovie(client, "admin-due-overlap", now);
    const first = createPrismaPublishDue(client, { supportedTerritories: ["TR"] });
    const second = createPrismaPublishDue(client, { supportedTerritories: ["TR"] });

    const results = await Promise.all([
      first.publishDue(now, 10, "req_publish_due_overlap_first"),
      second.publishDue(now, 10, "req_publish_due_overlap_second"),
    ]);

    expect(results.reduce((total, result) => total + result.publishedMovies.length, 0)).toBe(1);
    await expect(
      client.auditEvent.count({ where: { action: "MOVIE_PUBLISHED", targetId: movie.id } }),
    ).resolves.toBe(1);
    await expect(
      client.movie.findUniqueOrThrow({ where: { id: movie.id } }),
    ).resolves.toMatchObject({ publicationState: "PUBLISHED", revision: 2 });
  });
});
