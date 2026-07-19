import type { PrismaClient } from "@/generated/prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPrismaAccountLifecycleRepository } from "@/modules/identity/infrastructure/prisma-account-lifecycle-repository";
import { createDatabaseClient } from "@/shared/db/client-factory";

const localTestDatabaseUrl =
  "postgresql://film:film@127.0.0.1:54329/film_platform_test?schema=public";
const fixtureEmails = [
  "deletion-member@film-platform.invalid",
  "deletion-admin-a@film-platform.invalid",
  "deletion-admin-b@film-platform.invalid",
] as const;

function resolveTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL ?? localTestDatabaseUrl;
  if (!new URL(value).pathname.slice(1).endsWith("_test")) {
    throw new Error("Account lifecycle tests require a database name ending in _test");
  }
  return value;
}

describe("Prisma account lifecycle", () => {
  let client: PrismaClient;
  const fixtureUserIds: string[] = [];

  async function cleanupFixtures() {
    const users = await client.user.findMany({
      where: { email: { in: [...fixtureEmails] } },
      select: { id: true },
    });
    const userIds = [...new Set([...fixtureUserIds, ...users.map(({ id }) => id)])];
    await client.verificationToken.deleteMany({
      where: { identifier: { in: [...fixtureEmails] } },
    });
    if (userIds.length > 0) {
      await client.accountDeletionRequest.deleteMany({ where: { userId: { in: userIds } } });
    }
    await client.user.deleteMany({ where: { email: { in: [...fixtureEmails] } } });
  }

  beforeAll(async () => {
    client = createDatabaseClient(resolveTestDatabaseUrl());
    await cleanupFixtures();
  });

  afterAll(async () => {
    await cleanupFixtures();
    await client.$disconnect();
  });

  it("atomically disables a member, revokes sessions and links, and records exactly 30 days", async () => {
    const repository = createPrismaAccountLifecycleRepository(client);
    const requestedAt = new Date("2026-07-19T12:00:00.000Z");
    const purgeAfter = new Date("2026-08-18T12:00:00.000Z");
    const movie = await client.movie.findUniqueOrThrow({ where: { slug: "kiyidaki-sessizlik" } });
    const user = await client.user.create({
      data: {
        email: fixtureEmails[0],
        profile: { create: { displayName: "Silinecek Üye" } },
        roles: { create: { role: "MEMBER" } },
        sessions: {
          create: {
            expires: new Date("2026-09-01T00:00:00.000Z"),
            sessionToken: "s".repeat(40),
          },
        },
        watchlist: { create: { movieId: movie.id } },
      },
    });
    fixtureUserIds.push(user.id);
    await client.verificationToken.create({
      data: {
        expires: new Date("2026-07-19T12:10:00.000Z"),
        identifier: fixtureEmails[0],
        token: "v".repeat(40),
      },
    });

    await expect(repository.requestDeletion(user.id, requestedAt, purgeAfter)).resolves.toBe(
      "requested",
    );
    await expect(repository.requestDeletion(user.id, requestedAt, purgeAfter)).resolves.toBe(
      "already-requested",
    );
    await expect(
      client.userProfile.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ deletedAt: requestedAt, disabledAt: requestedAt });
    await expect(client.session.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(
      client.verificationToken.count({ where: { identifier: fixtureEmails[0] } }),
    ).resolves.toBe(0);
    await expect(
      client.accountDeletionRequest.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ completedAt: null, purgeAfter, requestedAt });
  });

  it("serializes concurrent admin deletion so one active admin always remains", async () => {
    const repository = createPrismaAccountLifecycleRepository(client);
    const seededAdmin = await client.user.findUniqueOrThrow({
      where: { email: "admin@film-platform.invalid" },
    });
    const temporaryAdmins = await Promise.all(
      fixtureEmails.slice(1).map((email, index) =>
        client.user.create({
          data: {
            email,
            profile: { create: { displayName: `Geçici Yönetici ${index + 1}` } },
            roles: { createMany: { data: [{ role: "MEMBER" }, { role: "ADMIN" }] } },
          },
        }),
      ),
    );
    fixtureUserIds.push(...temporaryAdmins.map(({ id }) => id));
    const admins = [seededAdmin, ...temporaryAdmins];
    const requestedAt = new Date("2026-07-20T12:00:00.000Z");
    const purgeAfter = new Date("2026-08-19T12:00:00.000Z");

    try {
      const results = await Promise.all(
        admins.map((admin) => repository.requestDeletion(admin.id, requestedAt, purgeAfter)),
      );
      expect(results.filter((result) => result === "requested")).toHaveLength(2);
      expect(results.filter((result) => result === "final-admin")).toHaveLength(1);
      await expect(
        client.userRole.count({
          where: {
            role: "ADMIN",
            user: { profile: { is: { deletedAt: null, disabledAt: null } } },
          },
        }),
      ).resolves.toBe(1);
    } finally {
      await client.userProfile.update({
        where: { userId: seededAdmin.id },
        data: { deletedAt: null, disabledAt: null },
      });
      await client.accountDeletionRequest.deleteMany({
        where: { userId: { in: admins.map(({ id }) => id) } },
      });
      await client.user.deleteMany({ where: { id: { in: temporaryAdmins.map(({ id }) => id) } } });
    }
  });

  it("purges at the exact boundary, remains idempotent, and replays a preserved marker", async () => {
    const repository = createPrismaAccountLifecycleRepository(client);
    const user = await client.user.findUniqueOrThrow({ where: { email: fixtureEmails[0] } });
    const beforeBoundary = new Date("2026-08-18T11:59:59.999Z");
    const boundary = new Date("2026-08-18T12:00:00.000Z");

    await expect(repository.purgeDueAccounts(beforeBoundary, 10)).resolves.toEqual({
      examined: 0,
      failed: 0,
      purged: 0,
      skipped: 0,
    });
    await expect(client.user.findUnique({ where: { id: user.id } })).resolves.not.toBeNull();
    await expect(repository.purgeDueAccounts(boundary, 10)).resolves.toEqual({
      examined: 1,
      failed: 0,
      purged: 1,
      skipped: 0,
    });
    await expect(client.user.findUnique({ where: { id: user.id } })).resolves.toBeNull();
    const marker = await client.accountDeletionRequest.findUniqueOrThrow({
      where: { userId: user.id },
    });
    expect(marker.completedAt).toEqual(boundary);
    await expect(repository.purgeDueAccounts(boundary, 10)).resolves.toMatchObject({ purged: 0 });

    await client.user.create({
      data: {
        email: fixtureEmails[0],
        id: user.id,
        profile: {
          create: {
            deletedAt: marker.requestedAt,
            disabledAt: marker.requestedAt,
            displayName: "Geri Yüklenmiş Üye",
          },
        },
      },
    });
    await expect(repository.purgeDueAccounts(boundary, 10)).resolves.toMatchObject({ purged: 1 });
    await expect(client.user.findUnique({ where: { id: user.id } })).resolves.toBeNull();
    await expect(
      client.accountDeletionRequest.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ completedAt: boundary });
  });
});
