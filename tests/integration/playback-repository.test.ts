import type { PrismaClient } from "@/generated/prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPrismaPlaybackRepository } from "@/modules/playback/infrastructure/prisma-playback-repository";
import { evaluateWatchability } from "@/modules/playback/domain/watchability";
import { createDatabaseClient } from "@/shared/db/client-factory";

const localTestDatabaseUrl =
  "postgresql://film:film@127.0.0.1:54329/film_platform_test?schema=public";
const fixedNow = new Date("2026-07-19T12:00:00.000Z");

function resolveTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL ?? localTestDatabaseUrl;
  if (!new URL(value).pathname.slice(1).endsWith("_test")) {
    throw new Error("Playback integration tests require a database name ending in _test");
  }
  return value;
}

describe("Prisma playback repository", () => {
  let client: PrismaClient;
  let repository: ReturnType<typeof createPrismaPlaybackRepository>;

  beforeAll(() => {
    client = createDatabaseClient(resolveTestDatabaseUrl());
    repository = createPrismaPlaybackRepository(client);
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  async function candidateForSlug(slug: string) {
    const movie = await client.movie.findUniqueOrThrow({ where: { slug }, select: { id: true } });
    const candidate = await repository.findCandidateByMovieId(movie.id);
    if (candidate === null) {
      throw new Error(`Missing playback candidate for ${slug}`);
    }
    return candidate;
  }

  it("maps the seeded ready asset and active right into an eligible owned snapshot", async () => {
    const candidate = await candidateForSlug("kiyidaki-sessizlik");

    expect(candidate.assets).toEqual([
      expect.objectContaining({
        durationSeconds: 5_880,
        isActive: true,
        providerPlaybackId: "fake-playback-kiyidaki-sessizlik",
        state: "READY",
      }),
    ]);
    expect(
      evaluateWatchability({
        assets: candidate.assets,
        now: fixedNow,
        publicationState: candidate.publicationState,
        publishAt: candidate.publishAt,
        rights: candidate.rights,
        territory: "TR",
      }),
    ).toMatchObject({ allowed: true });
  });

  it("maps expired rights and draft preparation into distinct policy denials", async () => {
    const expired = await candidateForSlug("gece-vardiyasi");
    const draft = await candidateForSlug("kurgu-masasinda");

    expect(
      evaluateWatchability({
        assets: expired.assets,
        now: fixedNow,
        publicationState: expired.publicationState,
        publishAt: expired.publishAt,
        rights: expired.rights,
        territory: "TR",
      }),
    ).toEqual({ allowed: false, reason: "RIGHTS_UNAVAILABLE" });
    expect(draft.assets).toEqual([
      expect.objectContaining({ isActive: false, state: "PREPARING" }),
    ]);
    expect(
      evaluateWatchability({
        assets: draft.assets,
        now: fixedNow,
        publicationState: draft.publicationState,
        publishAt: draft.publishAt,
        rights: draft.rights,
        territory: "TR",
      }),
    ).toEqual({ allowed: false, reason: "PUBLICATION_UNAVAILABLE" });
  });
});
