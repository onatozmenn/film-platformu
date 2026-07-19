import type { PrismaClient } from "@/generated/prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { evaluateProductionCatalogAudit } from "@/modules/admin/application/production-catalog-audit";
import { readProductionCatalogAuditSnapshot } from "@/modules/admin/infrastructure/prisma-production-catalog-audit";
import { createDatabaseClient } from "@/shared/db/client-factory";

const localTestDatabaseUrl =
  "postgresql://film:film@127.0.0.1:54329/film_platform_test?schema=public";

function resolveTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL ?? localTestDatabaseUrl;
  if (!new URL(value).pathname.slice(1).endsWith("_test")) {
    throw new Error("Production catalog audit tests require a database name ending in _test");
  }
  return value;
}

describe("production catalog audit adapter", () => {
  let client: PrismaClient;

  beforeAll(() => {
    client = createDatabaseClient(resolveTestDatabaseUrl());
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  it("reports only aggregate rights and current playability facts", async () => {
    const snapshot = await readProductionCatalogAuditSnapshot(
      client,
      new Date("2026-07-19T12:00:00.000Z"),
      ["TR"],
    );

    expect(snapshot.activeRightsWithoutEvidenceCount).toBe(0);
    expect(snapshot.currentlyPlayableMovieCount).toBeGreaterThan(0);
    expect(snapshot.publishedMovieCount).toBeGreaterThan(0);
    expect(evaluateProductionCatalogAudit(snapshot)).toEqual({ ready: true });
  });
});
