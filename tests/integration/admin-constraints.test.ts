import type { PrismaClient } from "@/generated/prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@/shared/db/client-factory";

const localTestDatabaseUrl =
  "postgresql://film:film@127.0.0.1:54329/film_platform_test?schema=public";

function resolveTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL ?? localTestDatabaseUrl;
  if (!new URL(value).pathname.slice(1).endsWith("_test")) {
    throw new Error("Admin integration tests require a database name ending in _test");
  }
  return value;
}

describe("admin database constraints", () => {
  let client: PrismaClient;

  beforeAll(() => {
    client = createDatabaseClient(resolveTestDatabaseUrl());
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  it("enforces positive revisions, publication history, and immutable published slugs", async () => {
    const draft = await client.movie.findUniqueOrThrow({ where: { slug: "kurgu-masasinda" } });
    const published = await client.movie.findUniqueOrThrow({
      where: { slug: "kiyidaki-sessizlik" },
    });

    await client.movie.update({
      data: { slug: "kurgu-masasinda-gecici" },
      where: { id: draft.id },
    });
    await client.movie.update({ data: { slug: "kurgu-masasinda" }, where: { id: draft.id } });

    await expect(
      client.movie.update({ data: { slug: "degistirilemez" }, where: { id: published.id } }),
    ).rejects.toThrow();
    await expect(
      client.movie.update({ data: { revision: 0 }, where: { id: draft.id } }),
    ).rejects.toThrow();
    await expect(
      client.collection.update({
        data: { revision: 0 },
        where: { slug: "editorun-seckisi" },
      }),
    ).rejects.toThrow();
    await expect(
      client.movie.update({
        data: { firstPublishedAt: null },
        where: { id: published.id },
      }),
    ).rejects.toThrow();
  });

  it("requires paired scheduled-publication failure state", async () => {
    const draft = await client.movie.findUniqueOrThrow({ where: { slug: "kurgu-masasinda" } });

    await expect(
      client.movie.update({
        data: { lastPublishFailure: "CONTENT_INCOMPLETE" },
        where: { id: draft.id },
      }),
    ).rejects.toThrow();
    await expect(
      client.movie.update({
        data: {
          lastPublishAttemptAt: new Date("2026-07-19T12:00:00.000Z"),
          lastPublishFailure: "CONTENT_INCOMPLETE",
        },
        where: { id: draft.id },
      }),
    ).rejects.toThrow();
  });

  it("permits unverified legacy rights but validates supplied evidence references", async () => {
    const movie = await client.movie.findUniqueOrThrow({ where: { slug: "kurgu-masasinda" } });
    const startsAt = new Date("2040-01-01T00:00:00.000Z");
    const endsAt = new Date("2041-01-01T00:00:00.000Z");
    const legacy = await client.contentRight.create({
      data: { allowStreaming: true, endsAt, movieId: movie.id, startsAt, territory: "TR" },
    });

    try {
      await expect(
        client.contentRight.create({
          data: {
            allowStreaming: true,
            endsAt,
            evidenceReference: "invalid evidence reference",
            movieId: movie.id,
            startsAt,
            territory: "DE",
          },
        }),
      ).rejects.toThrow();

      const verified = await client.contentRight.create({
        data: {
          allowStreaming: true,
          endsAt,
          evidenceReference: "license:fixture/de-2040",
          movieId: movie.id,
          startsAt,
          territory: "DE",
        },
      });
      await client.contentRight.delete({ where: { id: verified.id } });
    } finally {
      await client.contentRight.delete({ where: { id: legacy.id } });
    }
  });

  it("keeps audit facts immutable while allowing account-purge actor unlinking", async () => {
    await client.$executeRaw`TRUNCATE TABLE "audit_events"`;
    const actor = await client.user.create({
      data: { email: "audit-actor@film-platform.invalid", name: "Denetim Oyuncusu" },
    });
    const target = await client.movie.findUniqueOrThrow({ where: { slug: "kurgu-masasinda" } });
    const event = await client.auditEvent.create({
      data: {
        action: "MOVIE_UPDATED",
        actorType: "USER",
        actorUserId: actor.id,
        metadata: { changedFields: ["title"] },
        requestId: "req_admin_constraints",
        targetId: target.id,
        targetType: "MOVIE",
      },
    });

    try {
      await expect(
        client.auditEvent.update({
          data: { action: "MOVIE_PUBLISHED" },
          where: { id: event.id },
        }),
      ).rejects.toThrow();
      await expect(client.auditEvent.delete({ where: { id: event.id } })).rejects.toThrow();
      await expect(
        client.auditEvent.create({
          data: {
            action: "MOVIE_UPDATED",
            actorType: "SYSTEM",
            actorUserId: actor.id,
            requestId: "req_invalid_system_actor",
            targetId: target.id,
            targetType: "MOVIE",
          },
        }),
      ).rejects.toThrow();
      await expect(
        client.auditEvent.create({
          data: {
            action: "invalid-action",
            actorType: "USER",
            actorUserId: actor.id,
            requestId: "req_invalid_action",
            targetId: target.id,
            targetType: "MOVIE",
          },
        }),
      ).rejects.toThrow();
      await expect(
        client.auditEvent.create({
          data: {
            action: "MOVIE_UPDATED",
            actorType: "USER",
            actorUserId: actor.id,
            metadata: [],
            requestId: "req_invalid_metadata",
            targetId: target.id,
            targetType: "MOVIE",
          },
        }),
      ).rejects.toThrow();

      await client.user.delete({ where: { id: actor.id } });
      await expect(
        client.auditEvent.findUniqueOrThrow({ where: { id: event.id } }),
      ).resolves.toEqual(expect.objectContaining({ actorUserId: null }));
    } finally {
      await client.$executeRaw`TRUNCATE TABLE "audit_events"`;
      await client.user.deleteMany({ where: { id: actor.id } });
    }
  });
});
