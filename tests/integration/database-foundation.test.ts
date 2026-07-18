import type { PrismaClient } from "@/generated/prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@/shared/db/client-factory";

const localTestDatabaseUrl =
  "postgresql://film:film@127.0.0.1:54329/film_platform_test?schema=public";

function resolveTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL ?? localTestDatabaseUrl;
  const databaseName = new URL(value).pathname.slice(1);

  if (!databaseName.endsWith("_test")) {
    throw new Error("Integration tests require a database name ending in _test");
  }

  return value;
}

describe("database foundation", () => {
  let client: PrismaClient;

  beforeAll(() => {
    client = createDatabaseClient(resolveTestDatabaseUrl());
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  it("connects to the isolated PostgreSQL database", async () => {
    const result = await client.$queryRaw<Array<{ value: number }>>`SELECT 1 AS value`;

    expect(result).toEqual([{ value: 1 }]);
  });

  it("contains exactly the active WP-03 catalog and playback tables", async () => {
    const tables = await client.$queryRaw<Array<{ tableName: string }>>`
      SELECT table_name AS "tableName"
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name <> '_prisma_migrations'
      ORDER BY table_name
    `;

    expect(tables.map(({ tableName }) => tableName)).toEqual([
      "collection_movies",
      "collections",
      "content_rights",
      "credits",
      "genres",
      "metadata_sources",
      "movie_genres",
      "movies",
      "people",
      "processed_webhooks",
      "subtitle_tracks",
      "video_assets",
    ]);
  });
});
