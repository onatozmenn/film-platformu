import type { PrismaClient } from "@/generated/prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@/shared/db/client-factory";

const localTestDatabaseUrl =
  "postgresql://film:film@127.0.0.1:54329/film_platform_test?schema=public";

function resolveTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL ?? localTestDatabaseUrl;
  if (!new URL(value).pathname.slice(1).endsWith("_test")) {
    throw new Error("Playback integration tests require a database name ending in _test");
  }
  return value;
}

describe("playback database constraints", () => {
  let client: PrismaClient;

  beforeAll(() => {
    client = createDatabaseClient(resolveTestDatabaseUrl());
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  it("enforces one active ready asset and one default subtitle per asset", async () => {
    const movie = await client.movie.findUniqueOrThrow({ where: { slug: "yarin-kalanlar" } });
    const asset = await client.videoAsset.create({
      data: {
        durationSeconds: 5_880,
        isActive: true,
        movieId: movie.id,
        provider: "MUX",
        providerAssetId: "constraint-asset-active",
        providerPlaybackId: "constraint-playback-active",
        state: "READY",
      },
    });

    try {
      await expect(
        client.videoAsset.create({
          data: {
            durationSeconds: 5_880,
            isActive: true,
            movieId: movie.id,
            provider: "MUX",
            providerAssetId: "constraint-asset-duplicate",
            providerPlaybackId: "constraint-playback-duplicate",
            state: "READY",
          },
        }),
      ).rejects.toThrow();
      await expect(
        client.videoAsset.create({
          data: {
            isActive: true,
            movieId: movie.id,
            provider: "MUX",
            providerAssetId: "constraint-asset-preparing",
            state: "PREPARING",
          },
        }),
      ).rejects.toThrow();

      await client.subtitleTrack.create({
        data: {
          isDefault: true,
          kind: "SUBTITLES",
          label: "Türkçe",
          languageTag: "tr",
          providerTrackId: "constraint-track-tr",
          videoAssetId: asset.id,
        },
      });
      await expect(
        client.subtitleTrack.create({
          data: {
            isDefault: true,
            kind: "CAPTIONS",
            label: "English captions",
            languageTag: "en-US",
            providerTrackId: "constraint-track-en",
            videoAssetId: asset.id,
          },
        }),
      ).rejects.toThrow();
    } finally {
      await client.videoAsset.delete({ where: { id: asset.id } });
    }
  });

  it("rejects invalid and contradictory rights windows while allowing equal overlapping policy", async () => {
    const movie = await client.movie.findUniqueOrThrow({ where: { slug: "kiyidaki-sessizlik" } });
    const startsAt = new Date("2026-07-01T00:00:00.000Z");
    const endsAt = new Date("2026-08-01T00:00:00.000Z");
    const first = await client.contentRight.create({
      data: { allowStreaming: true, endsAt, movieId: movie.id, startsAt, territory: "TR" },
    });

    try {
      await expect(
        client.contentRight.create({
          data: {
            allowStreaming: false,
            endsAt: new Date("2026-07-20T00:00:00.000Z"),
            movieId: movie.id,
            startsAt: new Date("2026-07-10T00:00:00.000Z"),
            territory: "TR",
          },
        }),
      ).rejects.toThrow();
      await expect(
        client.contentRight.create({
          data: {
            allowStreaming: true,
            endsAt: startsAt,
            movieId: movie.id,
            startsAt: endsAt,
            territory: "TR",
          },
        }),
      ).rejects.toThrow();

      const overlappingAllow = await client.contentRight.create({
        data: {
          allowStreaming: true,
          endsAt: new Date("2026-07-20T00:00:00.000Z"),
          movieId: movie.id,
          startsAt: new Date("2026-07-10T00:00:00.000Z"),
          territory: "TR",
        },
      });
      await client.contentRight.delete({ where: { id: overlappingAllow.id } });
    } finally {
      await client.contentRight.delete({ where: { id: first.id } });
    }
  });
});
