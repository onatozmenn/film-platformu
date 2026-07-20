import type { PrismaClient } from "@/generated/prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import openFilmCatalog from "@/content/open-film-catalog.json";
import type { OpenFilmProviderAsset } from "@/modules/catalog/application/ingest-open-film";
import {
  parseOpenFilmManifest,
  type OpenFilm,
} from "@/modules/catalog/application/open-film-manifest";
import { createPrismaOpenFilmIngest } from "@/modules/catalog/infrastructure/prisma-open-film-ingest";
import { createDatabaseClient } from "@/shared/db/client-factory";

const localTestDatabaseUrl =
  "postgresql://film:film@127.0.0.1:54329/film_platform_test?schema=public";
const movieId = "00000000-0000-4000-8000-000000000120";
const movieSlug = "open-film-ingest-integration";

function resolveTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL ?? localTestDatabaseUrl;
  if (!new URL(value).pathname.slice(1).endsWith("_test")) {
    throw new Error("Open film ingest integration tests require a database name ending in _test");
  }
  return value;
}

function firstValue<T>(values: readonly T[]): T {
  const value = values[0];
  if (value === undefined) throw new Error("Missing fixture value");
  return value;
}

const baseFilm = firstValue(parseOpenFilmManifest(openFilmCatalog).films);
const film: OpenFilm = {
  ...baseFilm,
  id: movieId,
  slug: movieSlug,
  title: "Açık Film Ingest Entegrasyonu",
};
const preparingAsset: OpenFilmProviderAsset = {
  durationSeconds: null,
  id: "mux-open-film-integration",
  playbackId: "mux-open-film-playback",
  state: "PREPARING",
};
const readyAsset: OpenFilmProviderAsset = {
  ...preparingAsset,
  durationSeconds: 596,
  state: "READY",
};
const observedAt = new Date("2026-07-20T12:00:00.000Z");

describe("Prisma open film ingest", () => {
  let client: PrismaClient;
  let repository: ReturnType<typeof createPrismaOpenFilmIngest>;

  async function cleanFixture(): Promise<void> {
    await client.$executeRaw`TRUNCATE TABLE "audit_events"`;
    await client.movie.deleteMany({ where: { id: movieId } });
  }

  beforeAll(() => {
    client = createDatabaseClient(resolveTestDatabaseUrl());
    repository = createPrismaOpenFilmIngest(client, ["TR"]);
  });

  beforeEach(cleanFixture);
  afterEach(cleanFixture);
  afterAll(async () => client.$disconnect());

  it("persists preparation, publishes readiness, and remains idempotent", async () => {
    await expect(repository.findProviderAssetId(movieId)).resolves.toBeNull();
    await repository.sync({ asset: preparingAsset, film, observedAt });

    await expect(client.movie.findUniqueOrThrow({ where: { id: movieId } })).resolves.toMatchObject(
      {
        publicationState: "DRAFT",
        slug: movieSlug,
      },
    );
    await expect(
      client.videoAsset.findUniqueOrThrow({
        where: {
          provider_providerAssetId: {
            provider: "MUX",
            providerAssetId: preparingAsset.id,
          },
        },
      }),
    ).resolves.toMatchObject({ isActive: false, state: "PREPARING" });

    await repository.sync({ asset: readyAsset, film, observedAt });
    await repository.sync({ asset: readyAsset, film, observedAt });

    await expect(client.movie.findUniqueOrThrow({ where: { id: movieId } })).resolves.toMatchObject(
      {
        firstPublishedAt: observedAt,
        publicationState: "PUBLISHED",
      },
    );
    await expect(repository.findProviderAssetId(movieId)).resolves.toBe(readyAsset.id);
    await expect(client.videoAsset.findMany({ where: { movieId } })).resolves.toEqual([
      expect.objectContaining({
        durationSeconds: 596,
        isActive: true,
        providerPlaybackId: readyAsset.playbackId,
        state: "READY",
      }),
    ]);
    await expect(client.contentRight.count({ where: { movieId } })).resolves.toBe(1);
    await expect(client.movieGenre.count({ where: { movieId } })).resolves.toBe(2);
    await expect(client.credit.count({ where: { movieId } })).resolves.toBe(2);
    await expect(
      client.collectionMovie.count({
        where: { collection: { slug: "yeni-eklenenler" }, movieId },
      }),
    ).resolves.toBe(1);
    await expect(
      client.auditEvent.count({ where: { action: "OPEN_FILM_SYNCED", targetId: movieId } }),
    ).resolves.toBe(2);
  });
});
