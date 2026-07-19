import type { PrismaClient } from "@/generated/prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type {
  CreateMovieDraftCommand,
  MovieMutationView,
} from "@/modules/admin/application/admin-command-port";
import { createPrismaPublicationCommands } from "@/modules/admin/infrastructure/prisma-publication-commands";
import { createDatabaseClient } from "@/shared/db/client-factory";

const localTestDatabaseUrl =
  "postgresql://film:film@127.0.0.1:54329/film_platform_test?schema=public";
const now = new Date("2026-07-19T12:00:00.000Z");
const editorId = "50000000-0000-4000-8000-000000000002";
const memberId = "50000000-0000-4000-8000-000000000001";

function resolveTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL ?? localTestDatabaseUrl;
  if (!new URL(value).pathname.slice(1).endsWith("_test")) {
    throw new Error("Admin publication tests require a database name ending in _test");
  }
  return value;
}

function image(src: string) {
  return {
    alt: "Kurgusal yayın testi görseli",
    focalPosition: "50% 50%",
    height: 1_200,
    src,
    width: 800,
  } as const;
}

function draftCommand(slug: string, genreId: string): CreateMovieDraftCommand {
  return {
    actorUserId: editorId,
    ageRating: "13+",
    backdrop: image("/fixtures/catalog/theater-interior.jpg"),
    genreIds: [genreId],
    originalTitle: null,
    poster: image("/fixtures/catalog/fog-coast.jpg"),
    releaseDate: new Date("2026-01-01T00:00:00.000Z"),
    requestId: `req_create_${slug}`,
    runtimeMinutes: 98,
    slug,
    synopsis: "Yayın komutlarının atomik davranışını doğrulayan kurgusal film özeti.",
    title: "Yayın Komutu Test Filmi",
  };
}

async function requireSuccess(
  result: Awaited<
    ReturnType<ReturnType<typeof createPrismaPublicationCommands>["createMovieDraft"]>
  >,
): Promise<MovieMutationView> {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`Expected success, received ${result.code}`);
  }
  return result.data;
}

describe("admin publication commands", () => {
  let client: PrismaClient;
  let genreId: string;

  beforeAll(async () => {
    client = createDatabaseClient(resolveTestDatabaseUrl());
    genreId = (await client.genre.findUniqueOrThrow({ where: { slug: "dram" } })).id;
  });

  afterEach(async () => {
    await client.$executeRaw`TRUNCATE TABLE "audit_events"`;
    await client.movie.deleteMany({ where: { slug: { startsWith: "admin-yayin-" } } });
    await client.person.deleteMany({ where: { name: { startsWith: "Admin Test Imported" } } });
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  it("imports allowed metadata with source attribution but without third-party imagery", async () => {
    const commands = createPrismaPublicationCommands(client, {
      clock: () => now,
      supportedTerritories: ["TR"],
    });
    const metadata = {
      backdropPath: "/provider-backdrop.jpg",
      credits: [
        {
          billingOrder: 0,
          characterName: null,
          kind: "DIRECTOR" as const,
          name: "Admin Test Imported Director",
          personExternalId: "9001",
          profileImagePath: "/provider-person.jpg",
        },
      ],
      externalId: "4242",
      genres: [{ externalId: "18", name: "Dram" }],
      originalTitle: "Admin Import Movie",
      posterPath: "/provider-poster.jpg",
      provider: "TMDB" as const,
      releaseDate: "2026-01-01",
      runtimeMinutes: 98,
      synopsis: "İçe aktarılan kaynak atfını doğrulayan yeterince uzun kurgusal özet.",
      title: "Admin Yayın İçe Aktarım",
    };
    const command = {
      actorUserId: editorId,
      externalId: metadata.externalId,
      metadata,
      requestId: "req_metadata_import",
    };

    await expect(commands.importMovieDraft({ ...command, actorUserId: memberId })).resolves.toEqual(
      { code: "FORBIDDEN", ok: false },
    );
    const result = await commands.importMovieDraft(command);
    expect(result).toMatchObject({
      data: { revision: 1, slug: "admin-yayin-ice-aktarim" },
      ok: true,
    });
    if (!result.ok) {
      throw new Error("Expected metadata import success");
    }
    await expect(
      client.movie.findUniqueOrThrow({
        where: { id: result.data.id },
        include: {
          credits: { include: { person: true } },
          genres: { include: { genre: true } },
          metadataSources: true,
        },
      }),
    ).resolves.toMatchObject({
      backdropSrc: null,
      credits: [expect.objectContaining({ person: expect.objectContaining({ provider: "TMDB" }) })],
      genres: [expect.objectContaining({ genre: expect.objectContaining({ slug: "dram" }) })],
      metadataSources: [expect.objectContaining({ externalId: "4242", provider: "TMDB" })],
      posterSrc: null,
      publicationState: "DRAFT",
    });
    await expect(
      client.auditEvent.findFirstOrThrow({
        where: { action: "MOVIE_IMPORTED", targetId: result.data.id },
        select: { metadata: true },
      }),
    ).resolves.toEqual({ metadata: { count: 1, source: "TMDB" } });
    await expect(
      commands.importMovieDraft({ ...command, requestId: "req_duplicate_import" }),
    ).resolves.toEqual({ code: "CONFLICT", ok: false });
  });

  it("authorizes draft creation and permits exactly one concurrent optimistic edit", async () => {
    const commands = createPrismaPublicationCommands(client, {
      clock: () => now,
      supportedTerritories: ["TR"],
    });
    const denied = await commands.createMovieDraft({
      ...draftCommand("admin-yayin-denied", genreId),
      actorUserId: memberId,
    });
    expect(denied).toEqual({ code: "FORBIDDEN", ok: false });

    const created = await requireSuccess(
      await commands.createMovieDraft(draftCommand("admin-yayin-concurrency", genreId)),
    );
    const baseUpdate = {
      ...draftCommand(created.slug, genreId),
      expectedRevision: created.revision,
      movieId: created.id,
    };
    const outcomes = await Promise.all([
      commands.updateMovieEditorialData({
        ...baseUpdate,
        requestId: "req_update_first",
        title: "Birinci Eşzamanlı Başlık",
      }),
      commands.updateMovieEditorialData({
        ...baseUpdate,
        requestId: "req_update_second",
        title: "İkinci Eşzamanlı Başlık",
      }),
    ]);

    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    expect(outcomes.filter((outcome) => !outcome.ok && outcome.code === "CONFLICT")).toHaveLength(
      1,
    );
    await expect(
      client.auditEvent.findMany({
        where: { targetId: created.id },
        orderBy: { createdAt: "asc" },
        select: { action: true },
      }),
    ).resolves.toEqual([{ action: "MOVIE_CREATED" }, { action: "MOVIE_EDITORIAL_UPDATED" }]);
  });

  it("rejects incomplete publication, then publishes and unpublishes atomically", async () => {
    const commands = createPrismaPublicationCommands(client, {
      clock: () => now,
      supportedTerritories: ["TR"],
    });
    const created = await requireSuccess(
      await commands.createMovieDraft(draftCommand("admin-yayin-lifecycle", genreId)),
    );

    await expect(
      commands.publishMovie({
        actorUserId: editorId,
        expectedRevision: created.revision,
        movieId: created.id,
        requestId: "req_publish_incomplete",
      }),
    ).resolves.toMatchObject({
      code: "INVALID_INPUT",
      fieldErrors: {
        publication: expect.arrayContaining([
          expect.stringContaining("gösterim hakkı"),
          expect.stringContaining("video varlığı"),
        ]),
      },
      ok: false,
    });

    await client.videoAsset.create({
      data: {
        durationSeconds: 5_880,
        isActive: true,
        movieId: created.id,
        provider: "MUX",
        providerAssetId: "fake-asset-admin-lifecycle",
        providerPlaybackId: "fake-playback-admin-lifecycle",
        state: "READY",
      },
    });
    await client.contentRight.create({
      data: {
        allowStreaming: true,
        endsAt: new Date("2026-08-01T00:00:00.000Z"),
        evidenceReference: "fixture-license:admin-lifecycle",
        movieId: created.id,
        startsAt: now,
        territory: "TR",
      },
    });

    const publishedResult = await commands.publishMovie({
      actorUserId: editorId,
      expectedRevision: created.revision,
      movieId: created.id,
      requestId: "req_publish_complete",
    });
    expect(publishedResult).toMatchObject({ data: { revision: 2 }, ok: true });
    if (!publishedResult.ok) {
      throw new Error("Expected publication success");
    }
    const published = await client.movie.findUniqueOrThrow({ where: { id: created.id } });
    expect(published).toMatchObject({
      firstPublishedAt: now,
      publicationState: "PUBLISHED",
      publishAt: null,
      revision: 2,
    });

    await expect(
      commands.unpublishMovie({
        actorUserId: editorId,
        expectedRevision: publishedResult.data.revision,
        movieId: created.id,
        reason: "EDITORIAL",
        requestId: "req_unpublish",
      }),
    ).resolves.toMatchObject({ data: { revision: 3 }, ok: true });
    await expect(
      client.movie.findUniqueOrThrow({ where: { id: created.id } }),
    ).resolves.toMatchObject({
      firstPublishedAt: now,
      publicationState: "UNPUBLISHED",
      revision: 3,
    });
    await expect(
      client.auditEvent.findMany({
        where: { targetId: created.id },
        orderBy: { createdAt: "asc" },
        select: { action: true, metadata: true },
      }),
    ).resolves.toEqual([
      { action: "MOVIE_CREATED", metadata: { source: "MANUAL" } },
      { action: "MOVIE_PUBLISHED", metadata: { source: "MANUAL" } },
      { action: "MOVIE_UNPUBLISHED", metadata: { reason: "EDITORIAL" } },
    ]);
  });

  it("evaluates a schedule at its future instant and records it once", async () => {
    const commands = createPrismaPublicationCommands(client, {
      clock: () => now,
      supportedTerritories: ["TR"],
    });
    const created = await requireSuccess(
      await commands.createMovieDraft(draftCommand("admin-yayin-scheduled", genreId)),
    );
    const publishAt = new Date("2026-07-20T12:00:00.000Z");
    await client.videoAsset.create({
      data: {
        durationSeconds: 5_880,
        isActive: true,
        movieId: created.id,
        provider: "MUX",
        providerAssetId: "fake-asset-admin-scheduled",
        providerPlaybackId: "fake-playback-admin-scheduled",
        state: "READY",
      },
    });
    await client.contentRight.create({
      data: {
        allowStreaming: true,
        endsAt: new Date("2026-08-01T00:00:00.000Z"),
        evidenceReference: "fixture-license:admin-scheduled",
        movieId: created.id,
        startsAt: publishAt,
        territory: "TR",
      },
    });

    await expect(
      commands.scheduleMovie({
        actorUserId: editorId,
        expectedRevision: created.revision,
        movieId: created.id,
        publishAt: now,
        requestId: "req_schedule_early",
      }),
    ).resolves.toMatchObject({ code: "INVALID_INPUT", ok: false });
    await expect(
      commands.scheduleMovie({
        actorUserId: editorId,
        expectedRevision: created.revision,
        movieId: created.id,
        publishAt,
        requestId: "req_schedule_valid",
      }),
    ).resolves.toMatchObject({ data: { revision: 2 }, ok: true });
    await expect(
      client.movie.findUniqueOrThrow({ where: { id: created.id } }),
    ).resolves.toMatchObject({ publicationState: "SCHEDULED", publishAt, revision: 2 });
    await expect(
      commands.returnMovieToDraft({
        actorUserId: editorId,
        expectedRevision: 2,
        movieId: created.id,
        requestId: "req_schedule_cancel",
      }),
    ).resolves.toMatchObject({ data: { revision: 3 }, ok: true });
    await expect(
      client.movie.findUniqueOrThrow({ where: { id: created.id } }),
    ).resolves.toMatchObject({ publicationState: "DRAFT", publishAt: null, revision: 3 });
  });

  it("rolls a publication mutation back when its audit fact cannot commit", async () => {
    const commands = createPrismaPublicationCommands(client, {
      clock: () => now,
      supportedTerritories: ["TR"],
    });
    const created = await requireSuccess(
      await commands.createMovieDraft(draftCommand("admin-yayin-audit-rollback", genreId)),
    );
    await client.videoAsset.create({
      data: {
        durationSeconds: 5_880,
        isActive: true,
        movieId: created.id,
        provider: "MUX",
        providerAssetId: "fake-asset-admin-audit-rollback",
        providerPlaybackId: "fake-playback-admin-audit-rollback",
        state: "READY",
      },
    });
    await client.contentRight.create({
      data: {
        allowStreaming: true,
        endsAt: new Date("2026-08-01T00:00:00.000Z"),
        evidenceReference: "fixture-license:admin-audit-rollback",
        movieId: created.id,
        startsAt: now,
        territory: "TR",
      },
    });

    await expect(
      commands.publishMovie({
        actorUserId: editorId,
        expectedRevision: created.revision,
        movieId: created.id,
        requestId: "invalid request id",
      }),
    ).rejects.toThrow();
    await expect(
      client.movie.findUniqueOrThrow({ where: { id: created.id } }),
    ).resolves.toMatchObject({ firstPublishedAt: null, publicationState: "DRAFT", revision: 1 });
    await expect(
      client.auditEvent.count({ where: { action: "MOVIE_PUBLISHED", targetId: created.id } }),
    ).resolves.toBe(0);
  });
});
