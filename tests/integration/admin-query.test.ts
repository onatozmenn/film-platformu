import type { PrismaClient } from "@/generated/prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPrismaAdminQuery } from "@/modules/admin/infrastructure/prisma-admin-query";
import { createDatabaseClient } from "@/shared/db/client-factory";

const localTestDatabaseUrl =
  "postgresql://film:film@127.0.0.1:54329/film_platform_test?schema=public";
const memberId = "50000000-0000-4000-8000-000000000001";
const editorId = "50000000-0000-4000-8000-000000000002";
const adminId = "50000000-0000-4000-8000-000000000003";

function resolveTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL ?? localTestDatabaseUrl;
  if (!new URL(value).pathname.slice(1).endsWith("_test")) {
    throw new Error("Admin query tests require a database name ending in _test");
  }
  return value;
}

describe("admin private queries", () => {
  let client: PrismaClient;

  beforeAll(() => {
    client = createDatabaseClient(resolveTestDatabaseUrl());
  });

  afterEach(async () => {
    await client.$executeRaw`TRUNCATE TABLE "audit_events"`;
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  it("gives editors uncached workspace, editor, collections, and real-component preview models", async () => {
    const query = createPrismaAdminQuery(client);
    const draft = await client.movie.findUniqueOrThrow({ where: { slug: "kurgu-masasinda" } });

    await expect(query.getWorkspace(memberId)).resolves.toBeNull();
    const workspace = await query.getWorkspace(editorId);
    expect(workspace).toMatchObject({ actor: { id: editorId }, totals: { DRAFT: 1 } });
    expect(workspace?.movies.some(({ id }) => id === draft.id)).toBe(true);

    await expect(query.getCreateMovie(editorId)).resolves.toMatchObject({
      actor: { id: editorId },
      genreOptions: expect.arrayContaining([expect.objectContaining({ name: "Dram" })]),
    });

    await expect(query.getMovie(editorId, draft.id)).resolves.toMatchObject({
      actor: { id: editorId },
      id: draft.id,
      publicationState: "DRAFT",
      revision: 1,
    });
    await expect(query.getCollections(editorId)).resolves.toMatchObject({
      actor: { id: editorId },
      collections: expect.arrayContaining([expect.objectContaining({ slug: "editorun-seckisi" })]),
    });
    await expect(query.getPreview(editorId, draft.id)).resolves.toMatchObject({
      id: draft.id,
      isPlayable: false,
      similarMovies: [],
      slug: draft.slug,
      title: draft.title,
    });
    await expect(query.getRoles(editorId)).resolves.toBeNull();
    await expect(query.getAudit(editorId, 50)).resolves.toBeNull();
  });

  it("gives admins role state and a bounded, redacted, legacy-safe audit view", async () => {
    const query = createPrismaAdminQuery(client);
    const target = await client.movie.findUniqueOrThrow({ where: { slug: "kurgu-masasinda" } });
    await client.auditEvent.create({
      data: {
        action: "LEGACY_EVENT",
        actorType: "USER",
        actorUserId: adminId,
        metadata: {
          email: "private@film-platform.invalid",
          evidenceReference: "private-license-record",
          source: "MANUAL",
        },
        requestId: "req_admin_query",
        targetId: target.id,
        targetType: "LEGACY_TARGET",
      },
    });

    await expect(query.getRoles(adminId)).resolves.toMatchObject({
      accounts: expect.arrayContaining([
        expect.objectContaining({ id: memberId, roles: ["MEMBER"] }),
        expect.objectContaining({ id: editorId, roles: expect.arrayContaining(["EDITOR"]) }),
        expect.objectContaining({ id: adminId, roles: expect.arrayContaining(["ADMIN"]) }),
      ]),
      actor: { id: adminId },
    });
    await expect(query.getAudit(adminId, 500)).resolves.toEqual({
      actor: expect.objectContaining({ id: adminId }),
      events: [
        expect.objectContaining({
          action: "UNKNOWN",
          metadata: [{ key: "source", value: "MANUAL" }],
          targetType: "UNKNOWN",
        }),
      ],
    });
  });
});
