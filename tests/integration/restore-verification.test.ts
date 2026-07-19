import type { PrismaClient } from "@/generated/prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@/shared/db/client-factory";
import { readRestoreVerificationSnapshot } from "@/shared/release/prisma-restore-verification";
import { evaluateRestoreVerification } from "@/shared/release/restore-verification";

const localTestDatabaseUrl =
  "postgresql://film:film@127.0.0.1:54329/film_platform_test?schema=public";

function resolveTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL ?? localTestDatabaseUrl;
  if (!new URL(value).pathname.slice(1).endsWith("_test")) {
    throw new Error("Restore verification tests require a database name ending in _test");
  }
  return value;
}

describe("restored database aggregate verification", () => {
  let client: PrismaClient;

  beforeAll(() => {
    client = createDatabaseClient(resolveTestDatabaseUrl());
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  it("reads only aggregate facts and accepts the deterministic fixture state", async () => {
    const snapshot = await readRestoreVerificationSnapshot(
      client,
      new Date("2026-07-19T12:00:00.000Z"),
    );

    expect(snapshot).toMatchObject({
      activeAdminCount: 1,
      completedDeletionUsersRemaining: 0,
      dueDeletionRequestCount: 0,
      invalidPendingDeletionRequestCount: 0,
      publicationHistoryInvalidCount: 0,
    });
    expect(snapshot.catalogMovieCount).toBeGreaterThan(0);
    expect(evaluateRestoreVerification(snapshot)).toEqual({ ready: true });
  });
});
