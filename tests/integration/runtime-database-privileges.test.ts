import type { PrismaClient } from "@/generated/prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@/shared/db/client-factory";
import { readRuntimeDatabasePrivilegeSnapshot } from "@/shared/release/prisma-runtime-database-privileges";
import { evaluateRuntimeDatabasePrivileges } from "@/shared/release/runtime-database-privileges";

const localTestDatabaseUrl =
  "postgresql://film:film@127.0.0.1:54329/film_platform_test?schema=public";

function resolveTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL ?? localTestDatabaseUrl;
  if (!new URL(value).pathname.slice(1).endsWith("_test")) {
    throw new Error("Runtime privilege tests require a database name ending in _test");
  }
  return value;
}

describe("runtime database privilege inspection", () => {
  let client: PrismaClient;

  beforeAll(() => {
    client = createDatabaseClient(resolveTestDatabaseUrl());
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  it("detects the intentionally privileged local migration identity", async () => {
    const snapshot = await readRuntimeDatabasePrivilegeSnapshot(client);

    expect(
      snapshot.superuser || snapshot.canCreateSchemaObjects || snapshot.ownedTableCount > 0,
    ).toBe(true);
    expect(evaluateRuntimeDatabasePrivileges(snapshot)).toMatchObject({ ready: false });
  });
});
