import type { PrismaClient } from "@/generated/prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { VerifiedVideoEvent } from "@/modules/playback/application/playback-ports";
import { createPrismaVideoWebhookRepository } from "@/modules/playback/infrastructure/prisma-video-webhook-repository";
import { createDatabaseClient } from "@/shared/db/client-factory";

const localTestDatabaseUrl =
  "postgresql://film:film@127.0.0.1:54329/film_platform_test?schema=public";

function resolveTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL ?? localTestDatabaseUrl;
  if (!new URL(value).pathname.slice(1).endsWith("_test")) {
    throw new Error("Webhook integration tests require a database name ending in _test");
  }
  return value;
}

describe("Prisma video webhook repository", () => {
  let client: PrismaClient;
  let repository: ReturnType<typeof createPrismaVideoWebhookRepository>;

  beforeAll(() => {
    client = createDatabaseClient(resolveTestDatabaseUrl());
    repository = createPrismaVideoWebhookRepository(client);
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  it("deduplicates delivery and never revives errored or disabled assets", async () => {
    const movie = await client.movie.findUniqueOrThrow({ where: { slug: "yarin-kalanlar" } });
    const providerAssetId = "webhook-transition-asset";
    const eventIds = [
      "webhook-created",
      "webhook-ready",
      "webhook-created-stale",
      "webhook-errored",
      "webhook-ready-after-error",
      "webhook-deleted",
      "webhook-ready-after-delete",
    ];
    const asset = await client.videoAsset.create({
      data: {
        movieId: movie.id,
        provider: "MUX",
        providerAssetId,
        state: "PREPARING",
      },
    });
    type AssetStateEvent = Extract<
      VerifiedVideoEvent,
      { eventType: "ASSET_CREATED" | "ASSET_ERRORED" | "ASSET_READY" }
    >;
    const event = (eventId: string, eventType: AssetStateEvent["eventType"]): AssetStateEvent => ({
      durationSeconds: 6_480,
      eventId,
      eventType,
      playbackId: "webhook-signed-playback",
      providerAssetId,
    });
    const deletedEvent: Extract<VerifiedVideoEvent, { eventType: "ASSET_DELETED" }> = {
      durationSeconds: null,
      eventId: "webhook-deleted",
      eventType: "ASSET_DELETED",
      playbackId: null,
      providerAssetId,
    };

    try {
      await expect(
        repository.applyVerifiedEvent(event("webhook-created", "ASSET_CREATED")),
      ).resolves.toBe("applied");
      await expect(
        repository.applyVerifiedEvent(event("webhook-ready", "ASSET_READY")),
      ).resolves.toBe("applied");
      await expect(
        repository.applyVerifiedEvent(event("webhook-ready", "ASSET_READY")),
      ).resolves.toBe("duplicate");
      await expect(
        repository.applyVerifiedEvent(event("webhook-created-stale", "ASSET_CREATED")),
      ).resolves.toBe("ignored");
      await expect(
        repository.applyVerifiedEvent(event("webhook-errored", "ASSET_ERRORED")),
      ).resolves.toBe("applied");
      await expect(
        repository.applyVerifiedEvent(event("webhook-ready-after-error", "ASSET_READY")),
      ).resolves.toBe("ignored");
      await expect(repository.applyVerifiedEvent(deletedEvent)).resolves.toBe("applied");
      await expect(
        repository.applyVerifiedEvent(event("webhook-ready-after-delete", "ASSET_READY")),
      ).resolves.toBe("ignored");

      await expect(
        client.videoAsset.findUniqueOrThrow({ where: { id: asset.id } }),
      ).resolves.toMatchObject({
        isActive: false,
        state: "DISABLED",
      });
      await expect(
        client.processedWebhook.count({ where: { providerEventId: { in: eventIds } } }),
      ).resolves.toBe(eventIds.length);
    } finally {
      await client.processedWebhook.deleteMany({ where: { providerEventId: { in: eventIds } } });
      await client.videoAsset.delete({ where: { id: asset.id } });
    }
  });

  it("records a verified unknown asset once without fabricating a row", async () => {
    const event: VerifiedVideoEvent = {
      durationSeconds: 90,
      eventId: "webhook-missing-asset",
      eventType: "ASSET_READY",
      playbackId: "missing-playback",
      providerAssetId: "missing-asset",
    };

    try {
      await expect(repository.applyVerifiedEvent(event)).resolves.toBe("asset-not-found");
      await expect(repository.applyVerifiedEvent(event)).resolves.toBe("duplicate");
    } finally {
      await client.processedWebhook.deleteMany({ where: { providerEventId: event.eventId } });
    }
  });
});
