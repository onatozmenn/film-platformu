import type { PrismaClient } from "@/generated/prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createPrismaCatalogAdminCommands } from "@/modules/admin/infrastructure/prisma-catalog-admin-commands";
import { createDatabaseClient } from "@/shared/db/client-factory";

const localTestDatabaseUrl =
  "postgresql://film:film@127.0.0.1:54329/film_platform_test?schema=public";
const adminId = "50000000-0000-4000-8000-000000000003";
const editorId = "50000000-0000-4000-8000-000000000002";
const memberId = "50000000-0000-4000-8000-000000000001";

function resolveTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL ?? localTestDatabaseUrl;
  if (!new URL(value).pathname.slice(1).endsWith("_test")) {
    throw new Error("Admin catalog tests require a database name ending in _test");
  }
  return value;
}

async function cleanFixtures(client: PrismaClient): Promise<void> {
  await client.$executeRaw`TRUNCATE TABLE "audit_events"`;
  await client.collection.deleteMany({ where: { slug: { startsWith: "admin-yayin-" } } });
  await client.movie.deleteMany({ where: { slug: { startsWith: "admin-yayin-" } } });
  await client.person.deleteMany({ where: { name: { startsWith: "Admin Test" } } });
}

async function createDraft(client: PrismaClient, slug: string) {
  return client.movie.create({
    data: {
      releaseDate: new Date("2026-01-01T00:00:00.000Z"),
      runtimeMinutes: 90,
      slug,
      synopsis: "Yönetim komutlarını doğrulayan yeterince uzun kurgusal film özeti.",
      title: "Yönetim Komutu Filmi",
      titleSearch: "yonetim komutu filmi",
    },
  });
}

describe("admin catalog commands", () => {
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

  it("restricts assets and rights to admins while preserving owned asset transitions", async () => {
    const movie = await createDraft(client, "admin-yayin-assets-rights");
    const commands = createPrismaCatalogAdminCommands(client, { supportedTerritories: ["TR"] });
    const readyAsset = {
      actorUserId: adminId,
      makeActive: true,
      movieId: movie.id,
      providerAsset: {
        durationSeconds: 5_880,
        playbackId: "fake-playback-admin-command",
        providerAssetId: "fake-asset-admin-command",
        state: "READY" as const,
      },
      providerAssetId: "fake-asset-admin-command",
      requestId: "req_asset_attach",
    };

    await expect(
      commands.attachVideoAsset({ ...readyAsset, actorUserId: editorId }),
    ).resolves.toEqual({ code: "FORBIDDEN", ok: false });
    const attached = await commands.attachVideoAsset(readyAsset);
    expect(attached).toMatchObject({ data: { movieId: movie.id, state: "READY" }, ok: true });
    const storedAsset = await client.videoAsset.findUniqueOrThrow({
      where: {
        provider_providerAssetId: {
          provider: "MUX",
          providerAssetId: readyAsset.providerAssetId,
        },
      },
    });
    expect(storedAsset.isActive).toBe(true);

    await expect(
      commands.reconcileVideoAsset({
        ...readyAsset,
        makeActive: false,
        requestId: "req_reconcile",
      }),
    ).resolves.toMatchObject({ data: { state: "READY" }, ok: true });
    await expect(
      client.videoAsset.findUniqueOrThrow({ where: { id: storedAsset.id } }),
    ).resolves.toMatchObject({ isActive: true, state: "READY" });
    await expect(
      commands.reconcileVideoAsset({
        ...readyAsset,
        makeActive: false,
        providerAsset: { ...readyAsset.providerAsset, playbackId: null, state: "PREPARING" },
        requestId: "req_invalid_regression",
      }),
    ).resolves.toMatchObject({ code: "INVALID_INPUT", ok: false });

    const rightCommand = {
      actorUserId: adminId,
      allowStreaming: true,
      endsAt: new Date("2026-08-01T00:00:00.000Z"),
      evidenceReference: "fixture-license:admin-command",
      movieId: movie.id,
      requestId: "req_right_set",
      rightId: null,
      startsAt: new Date("2026-07-01T00:00:00.000Z"),
      territory: "TR",
    } as const;
    await expect(
      commands.setContentRight({ ...rightCommand, actorUserId: editorId }),
    ).resolves.toEqual({ code: "FORBIDDEN", ok: false });
    await expect(commands.setContentRight(rightCommand)).resolves.toMatchObject({ ok: true });
    await expect(
      commands.setContentRight({
        ...rightCommand,
        allowStreaming: false,
        evidenceReference: "fixture-license:admin-command-deny",
        requestId: "req_right_conflict",
      }),
    ).resolves.toEqual({ code: "CONFLICT", ok: false });

    await expect(
      client.movie.findUniqueOrThrow({ where: { id: movie.id } }),
    ).resolves.toMatchObject({ revision: 4 });
    const audits = await client.auditEvent.findMany({
      orderBy: { createdAt: "asc" },
      select: { action: true, metadata: true },
      where: { targetId: { in: [movie.id, storedAsset.id] } },
    });
    expect(audits.map(({ action }) => action)).toEqual([
      "VIDEO_ASSET_ATTACHED",
      "VIDEO_ASSET_RECONCILED",
    ]);
    const rightAudit = await client.auditEvent.findFirstOrThrow({
      where: { action: "CONTENT_RIGHT_SET" },
      select: { metadata: true },
    });
    expect(JSON.stringify(rightAudit.metadata)).not.toContain("fixture-license");
  });

  it("lets editors atomically replace credits and subtitle metadata with revision checks", async () => {
    const movie = await createDraft(client, "admin-yayin-credits-subtitles");
    const videoAsset = await client.videoAsset.create({
      data: {
        durationSeconds: 5_880,
        movieId: movie.id,
        provider: "MUX",
        providerAssetId: "fake-asset-admin-subtitles",
        providerPlaybackId: "fake-playback-admin-subtitles",
        state: "READY",
      },
    });
    const commands = createPrismaCatalogAdminCommands(client, { supportedTerritories: ["TR"] });
    const credits = [
      {
        billingOrder: 0,
        characterName: null,
        displayLabel: null,
        kind: "DIRECTOR" as const,
        personName: "Admin Test Yönetmen",
      },
      {
        billingOrder: 1,
        characterName: "Bekçi",
        displayLabel: null,
        kind: "CAST" as const,
        personName: "Admin Test Oyuncu",
      },
    ];

    await expect(
      commands.setMovieCredits({
        actorUserId: editorId,
        credits,
        expectedRevision: 1,
        movieId: movie.id,
        requestId: "req_credits",
      }),
    ).resolves.toMatchObject({ data: { revision: 2 }, ok: true });
    await expect(
      commands.setMovieCredits({
        actorUserId: editorId,
        credits,
        expectedRevision: 1,
        movieId: movie.id,
        requestId: "req_credits_stale",
      }),
    ).resolves.toEqual({ code: "CONFLICT", ok: false });
    await expect(client.credit.count({ where: { movieId: movie.id } })).resolves.toBe(2);

    const subtitleCommand = {
      actorUserId: editorId,
      assetId: videoAsset.id,
      movieId: movie.id,
      requestId: "req_subtitles",
      tracks: [
        {
          isDefault: true,
          kind: "SUBTITLES" as const,
          label: "Türkçe",
          languageTag: "tr",
          providerTrackId: "admin-track-tr",
        },
        {
          isDefault: false,
          kind: "CAPTIONS" as const,
          label: "English captions",
          languageTag: "en-US",
          providerTrackId: "admin-track-en",
        },
      ],
    };
    await expect(commands.setSubtitleTracks(subtitleCommand)).resolves.toMatchObject({ ok: true });
    await expect(
      commands.setSubtitleTracks({ ...subtitleCommand, actorUserId: memberId }),
    ).resolves.toEqual({ code: "FORBIDDEN", ok: false });
    await expect(
      client.subtitleTrack.count({ where: { videoAssetId: videoAsset.id } }),
    ).resolves.toBe(2);
    await expect(
      client.movie.findUniqueOrThrow({ where: { id: movie.id } }),
    ).resolves.toMatchObject({ revision: 3 });
  });

  it("creates collections and permits one concurrent optimistic replacement", async () => {
    const movie = await createDraft(client, "admin-yayin-collection-movie");
    const commands = createPrismaCatalogAdminCommands(client, { supportedTerritories: ["TR"] });
    const createCommand = {
      actorUserId: editorId,
      collectionId: null,
      description: "Yönetim seçkisi",
      displayOrder: 12,
      expectedRevision: null,
      movies: [{ movieId: movie.id, position: 0 }],
      requestId: "req_collection_create",
      slug: "admin-yayin-collection",
      state: "DRAFT" as const,
      title: "Yönetim Seçkisi",
    };

    await expect(
      commands.upsertCollection({ ...createCommand, actorUserId: memberId }),
    ).resolves.toEqual({ code: "FORBIDDEN", ok: false });
    const created = await commands.upsertCollection(createCommand);
    expect(created).toMatchObject({ data: { revision: 1 }, ok: true });
    if (!created.ok) {
      throw new Error("Expected collection creation success");
    }
    const update = {
      ...createCommand,
      collectionId: created.data.id,
      expectedRevision: created.data.revision,
      state: "PUBLISHED" as const,
    };
    const results = await Promise.all([
      commands.upsertCollection({ ...update, requestId: "req_collection_first" }),
      commands.upsertCollection({ ...update, requestId: "req_collection_second" }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok && result.code === "CONFLICT")).toHaveLength(1);
    await expect(
      client.collection.findUniqueOrThrow({ where: { id: created.data.id } }),
    ).resolves.toMatchObject({ revision: 2, state: "PUBLISHED" });
  });
});
