import { spawnSync } from "node:child_process";
import path from "node:path";

import type { PrismaClient } from "@/generated/prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@/shared/db/client-factory";

const localTestDatabaseUrl =
  "postgresql://film:film@127.0.0.1:54329/film_platform_test?schema=public";
const schemaName = `migration_replay_${process.pid}`;

function resolveTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL ?? localTestDatabaseUrl;
  if (!new URL(value).pathname.slice(1).endsWith("_test")) {
    throw new Error("Migration replay requires a database name ending in _test");
  }
  return value;
}

function withSchema(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", schema);
  return url.toString();
}

describe("catalog migration replay", () => {
  let maintenanceClient: PrismaClient;

  beforeAll(() => {
    maintenanceClient = createDatabaseClient(resolveTestDatabaseUrl());
  });

  afterAll(async () => {
    await maintenanceClient.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await maintenanceClient.$disconnect();
  });

  it("applies the checked-in migrations from empty to current", async () => {
    const replayUrl = withSchema(resolveTestDatabaseUrl(), schemaName);
    const result = spawnSync(
      process.execPath,
      [
        path.resolve("node_modules/prisma/build/index.js"),
        "migrate",
        "deploy",
        "--config",
        "prisma.test.config.ts",
      ],
      {
        cwd: path.resolve("."),
        encoding: "utf8",
        env: { ...process.env, TEST_DATABASE_URL: replayUrl },
      },
    );

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);

    const replayClient = createDatabaseClient(replayUrl);
    try {
      const tables = await replayClient.$queryRaw<Array<{ tableName: string }>>`
        SELECT table_name AS "tableName"
        FROM information_schema.tables
        WHERE table_schema = ${schemaName}
          AND table_name <> '_prisma_migrations'
        ORDER BY table_name
      `;

      expect(tables.map(({ tableName }) => tableName)).toEqual([
        "account_deletion_requests",
        "accounts",
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
        "ratings",
        "sessions",
        "subtitle_tracks",
        "user_profiles",
        "user_roles",
        "users",
        "verification_tokens",
        "video_assets",
        "watch_progress",
        "watchlist_entries",
      ]);
    } finally {
      await replayClient.$disconnect();
    }
  });
});
