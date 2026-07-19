import type { PrismaClient } from "@/generated/prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createPrismaAdminIdentityCommands } from "@/modules/admin/infrastructure/prisma-admin-identity-commands";
import { createDatabaseClient } from "@/shared/db/client-factory";

const localTestDatabaseUrl =
  "postgresql://film:film@127.0.0.1:54329/film_platform_test?schema=public";
const now = new Date("2026-07-19T12:00:00.000Z");
const memberId = "50000000-0000-4000-8000-000000000001";
const editorId = "50000000-0000-4000-8000-000000000002";
const adminId = "50000000-0000-4000-8000-000000000003";

function resolveTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL ?? localTestDatabaseUrl;
  if (!new URL(value).pathname.slice(1).endsWith("_test")) {
    throw new Error("Admin identity tests require a database name ending in _test");
  }
  return value;
}

async function createAdmin(client: PrismaClient, suffix: string) {
  const user = await client.user.create({
    data: {
      email: `admin-identity-${suffix}@film-platform.invalid`,
      name: `Geçici Yönetici ${suffix}`,
      profile: { create: { displayName: `Geçici Yönetici ${suffix}` } },
      roles: { create: [{ role: "MEMBER" }, { role: "ADMIN" }] },
    },
  });
  return user.id;
}

async function restoreSeedIdentity(client: PrismaClient): Promise<void> {
  await client.$executeRaw`TRUNCATE TABLE "audit_events"`;
  await client.user.deleteMany({
    where: { email: { startsWith: "admin-identity-" } },
  });
  await client.userProfile.updateMany({
    where: { userId: { in: [memberId, editorId, adminId] } },
    data: { deletedAt: null, disabledAt: null },
  });
  await client.userRole.deleteMany({
    where: {
      userId: { in: [memberId, editorId, adminId] },
      role: { in: ["ADMIN", "EDITOR"] },
    },
  });
  await client.userRole.createMany({
    data: [
      { grantedBy: editorId, role: "EDITOR", userId: editorId },
      { grantedBy: adminId, role: "ADMIN", userId: adminId },
    ],
    skipDuplicates: true,
  });
  await client.session.deleteMany({
    where: { userId: { in: [memberId, editorId, adminId] } },
  });
  await client.verificationToken.deleteMany({
    where: { identifier: { endsWith: "@film-platform.invalid" } },
  });
}

describe("admin identity commands", () => {
  let client: PrismaClient;

  beforeAll(() => {
    client = createDatabaseClient(resolveTestDatabaseUrl());
  });

  beforeEach(async () => {
    await restoreSeedIdentity(client);
  });

  afterEach(async () => {
    await restoreSeedIdentity(client);
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  it("restricts role changes to admins and revokes sessions after real privilege changes", async () => {
    const commands = createPrismaAdminIdentityCommands(client, { clock: () => now });
    const grant = {
      actorUserId: adminId,
      requestId: "req_role_grant",
      role: "EDITOR" as const,
      subjectUserId: memberId,
    };
    await expect(commands.grantRole({ ...grant, actorUserId: editorId })).resolves.toEqual({
      code: "FORBIDDEN",
      ok: false,
    });
    await client.session.create({
      data: {
        expires: new Date("2026-08-01T00:00:00.000Z"),
        sessionToken: "admin-identity-member-session-before-grant",
        userId: memberId,
      },
    });

    await expect(commands.grantRole(grant)).resolves.toEqual({
      data: { userId: memberId },
      ok: true,
    });
    await expect(client.session.count({ where: { userId: memberId } })).resolves.toBe(0);
    await expect(
      client.userRole.findUnique({
        where: { userId_role: { role: "EDITOR", userId: memberId } },
      }),
    ).resolves.not.toBeNull();
    await expect(
      commands.grantRole({ ...grant, requestId: "req_role_grant_duplicate" }),
    ).resolves.toEqual({ data: { userId: memberId }, ok: true });
    await expect(
      client.auditEvent.count({ where: { action: "ROLE_GRANTED", targetId: memberId } }),
    ).resolves.toBe(1);

    await client.session.create({
      data: {
        expires: new Date("2026-08-01T00:00:00.000Z"),
        sessionToken: "admin-identity-member-session-before-revoke",
        userId: memberId,
      },
    });
    await expect(commands.revokeRole({ ...grant, requestId: "req_role_revoke" })).resolves.toEqual({
      data: { userId: memberId },
      ok: true,
    });
    await expect(client.session.count({ where: { userId: memberId } })).resolves.toBe(0);
    await expect(
      client.auditEvent.findMany({
        orderBy: { createdAt: "asc" },
        select: { action: true, metadata: true },
        where: { targetId: memberId },
      }),
    ).resolves.toEqual([
      { action: "ROLE_GRANTED", metadata: { role: "EDITOR" } },
      { action: "ROLE_REVOKED", metadata: { role: "EDITOR" } },
    ]);
  });

  it("protects the final admin and disables a member idempotently without retaining PII", async () => {
    const commands = createPrismaAdminIdentityCommands(client, { clock: () => now });
    await expect(
      commands.disableAccount({
        actorUserId: adminId,
        requestId: "req_disable_final_admin",
        subjectUserId: adminId,
      }),
    ).resolves.toEqual({ code: "CONFLICT", ok: false });

    await client.session.create({
      data: {
        expires: new Date("2026-08-01T00:00:00.000Z"),
        sessionToken: "admin-identity-member-session-before-disable",
        userId: memberId,
      },
    });
    await client.verificationToken.create({
      data: {
        expires: new Date("2026-07-19T12:10:00.000Z"),
        identifier: "member@film-platform.invalid",
        token: "admin-identity-verification-token-before-disable",
      },
    });
    const disable = {
      actorUserId: adminId,
      requestId: "req_disable_member",
      subjectUserId: memberId,
    };
    await expect(commands.disableAccount(disable)).resolves.toEqual({
      data: { userId: memberId },
      ok: true,
    });
    await expect(
      commands.disableAccount({ ...disable, requestId: "req_disable_repeat" }),
    ).resolves.toEqual({ data: { userId: memberId }, ok: true });
    await expect(
      client.userProfile.findUniqueOrThrow({ where: { userId: memberId } }),
    ).resolves.toMatchObject({ disabledAt: now });
    await expect(client.session.count({ where: { userId: memberId } })).resolves.toBe(0);
    await expect(
      client.verificationToken.count({ where: { identifier: "member@film-platform.invalid" } }),
    ).resolves.toBe(0);
    const audits = await client.auditEvent.findMany({ where: { targetId: memberId } });
    expect(audits).toHaveLength(1);
    expect(JSON.stringify(audits[0]?.metadata)).not.toContain("member@");
  });

  it("serializes concurrent admin revocations so exactly one active admin remains", async () => {
    const firstTemporaryAdmin = await createAdmin(client, "first");
    const secondTemporaryAdmin = await createAdmin(client, "second");
    const commands = createPrismaAdminIdentityCommands(client, { clock: () => now });
    const subjects = [adminId, firstTemporaryAdmin, secondTemporaryAdmin];

    const outcomes = await Promise.all(
      subjects.map((subjectUserId, index) =>
        commands.revokeRole({
          actorUserId: subjectUserId,
          requestId: `req_concurrent_admin_${String(index)}`,
          role: "ADMIN",
          subjectUserId,
        }),
      ),
    );

    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(2);
    expect(outcomes.filter((outcome) => !outcome.ok && outcome.code === "CONFLICT")).toHaveLength(
      1,
    );
    await expect(
      client.userRole.count({
        where: {
          role: "ADMIN",
          user: { profile: { is: { deletedAt: null, disabledAt: null } } },
        },
      }),
    ).resolves.toBe(1);
    await expect(client.auditEvent.count({ where: { action: "ROLE_REVOKED" } })).resolves.toBe(2);
  });
});
