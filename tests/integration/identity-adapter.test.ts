import type { PrismaClient } from "@/generated/prisma/client";
import type { Adapter } from "next-auth/adapters";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createIdentityAdapter } from "@/modules/identity/infrastructure/prisma-identity-adapter";
import { createDatabaseClient } from "@/shared/db/client-factory";

const localTestDatabaseUrl =
  "postgresql://film:film@127.0.0.1:54329/film_platform_test?schema=public";

function resolveTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL ?? localTestDatabaseUrl;
  if (!new URL(value).pathname.slice(1).endsWith("_test")) {
    throw new Error("Identity adapter tests require a database name ending in _test");
  }
  return value;
}

function requireMethod<Key extends keyof Adapter>(
  adapter: Adapter,
  key: Key,
): NonNullable<Adapter[Key]> {
  const method = adapter[key];
  if (method === undefined || method === null) {
    throw new Error(`Identity adapter is missing ${key}`);
  }
  return method;
}

describe("Auth.js Prisma identity adapter", () => {
  let adapter: Adapter;
  let client: PrismaClient;

  beforeAll(() => {
    client = createDatabaseClient(resolveTestDatabaseUrl());
    adapter = createIdentityAdapter(client);
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  it("creates profile/member state and supports database sessions and single-use links", async () => {
    const createUser = requireMethod(adapter, "createUser");
    const createSession = requireMethod(adapter, "createSession");
    const getSessionAndUser = requireMethod(adapter, "getSessionAndUser");
    const createVerificationToken = requireMethod(adapter, "createVerificationToken");
    const useVerificationToken = requireMethod(adapter, "useVerificationToken");
    const email = "adapter-contract@film-platform.invalid";
    const sessionToken = "session_adapter_contract_0000000000000001";
    const verificationToken = "verification_adapter_contract_000000001";
    const expires = new Date("2026-08-01T00:00:00.000Z");
    let userId: string | undefined;

    try {
      const user = await createUser({
        email: email.toUpperCase(),
        emailVerified: null,
        image: null,
        name: null,
      });
      userId = user.id;

      await expect(
        client.user.findUniqueOrThrow({
          where: { id: user.id },
          include: { profile: true, roles: true },
        }),
      ).resolves.toMatchObject({
        email,
        profile: { displayName: "Film üyesi", disabledAt: null },
        roles: [{ role: "MEMBER" }],
      });

      await createSession({ expires, sessionToken, userId: user.id });
      await expect(getSessionAndUser(sessionToken)).resolves.toMatchObject({
        session: { expires, sessionToken, userId: user.id },
        user: { email, id: user.id },
      });

      await createVerificationToken({
        expires,
        identifier: email,
        token: verificationToken,
      });
      await expect(
        useVerificationToken({ identifier: email, token: verificationToken }),
      ).resolves.toMatchObject({ expires, identifier: email, token: verificationToken });
      await expect(
        useVerificationToken({ identifier: email, token: verificationToken }),
      ).resolves.toBeNull();
    } finally {
      await client.verificationToken.deleteMany({ where: { identifier: email } });
      if (userId !== undefined) {
        await client.user.deleteMany({ where: { id: userId } });
      }
    }
  });
});
