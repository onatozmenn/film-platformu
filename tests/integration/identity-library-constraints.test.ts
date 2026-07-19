import type { PrismaClient } from "@/generated/prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@/shared/db/client-factory";

const localTestDatabaseUrl =
  "postgresql://film:film@127.0.0.1:54329/film_platform_test?schema=public";

function resolveTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL ?? localTestDatabaseUrl;
  if (!new URL(value).pathname.slice(1).endsWith("_test")) {
    throw new Error("Identity integration tests require a database name ending in _test");
  }
  return value;
}

describe("identity and member-library constraints", () => {
  let client: PrismaClient;

  beforeAll(() => {
    client = createDatabaseClient(resolveTestDatabaseUrl());
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  it("seeds fictional member, editor, and admin capabilities exactly", async () => {
    const users = await client.user.findMany({
      where: { email: { endsWith: "@film-platform.invalid" } },
      orderBy: { email: "asc" },
      include: { profile: true, roles: { orderBy: { role: "asc" } } },
    });

    expect(
      users.map((user) => ({
        disabledAt: user.profile?.disabledAt,
        email: user.email,
        roles: user.roles.map(({ role }) => role),
      })),
    ).toEqual([
      {
        disabledAt: null,
        email: "admin@film-platform.invalid",
        roles: ["MEMBER", "ADMIN"],
      },
      {
        disabledAt: null,
        email: "editor@film-platform.invalid",
        roles: ["MEMBER", "EDITOR"],
      },
      {
        disabledAt: null,
        email: "member@film-platform.invalid",
        roles: ["MEMBER"],
      },
    ]);
  });

  it("enforces profile state, Auth.js token, and deletion-window invariants", async () => {
    const user = await client.user.create({
      data: { email: "constraint-auth@film-platform.invalid" },
    });
    const requestedAt = new Date("2026-07-19T00:00:00.000Z");

    try {
      await expect(
        client.userProfile.create({ data: { displayName: " ", userId: user.id } }),
      ).rejects.toThrow();
      await client.userProfile.create({ data: { displayName: "Kısıt Üyesi", userId: user.id } });
      await expect(
        client.session.create({
          data: {
            expires: new Date("2026-08-01T00:00:00.000Z"),
            sessionToken: "short",
            userId: user.id,
          },
        }),
      ).rejects.toThrow();
      await expect(
        client.verificationToken.create({
          data: {
            expires: new Date("2026-07-19T00:10:00.000Z"),
            identifier: "constraint-auth@film-platform.invalid",
            token: "short",
          },
        }),
      ).rejects.toThrow();
      await expect(
        client.accountDeletionRequest.create({
          data: {
            purgeAfter: new Date("2026-08-17T23:59:59.999Z"),
            requestedAt,
            userId: user.id,
          },
        }),
      ).rejects.toThrow();
      await expect(
        client.accountDeletionRequest.create({
          data: {
            purgeAfter: new Date("2026-08-18T00:00:00.000Z"),
            requestedAt,
            userId: user.id,
          },
        }),
      ).resolves.toMatchObject({ userId: user.id });
    } finally {
      await client.accountDeletionRequest.deleteMany({ where: { userId: user.id } });
      await client.user.delete({ where: { id: user.id } });
    }
  });

  it("enforces half-star and finite clamped progress invariants", async () => {
    const user = await client.user.create({
      data: {
        email: "constraint-library@film-platform.invalid",
        profile: { create: { displayName: "Kütüphane Üyesi" } },
      },
    });
    const movie = await client.movie.findUniqueOrThrow({ where: { slug: "kiyidaki-sessizlik" } });
    const observedAt = new Date("2026-07-19T00:00:00.000Z");

    try {
      await expect(
        client.rating.create({
          data: { movieId: movie.id, userId: user.id, valueHalfStars: 0 },
        }),
      ).rejects.toThrow();
      await expect(
        client.rating.create({
          data: { movieId: movie.id, userId: user.id, valueHalfStars: 11 },
        }),
      ).rejects.toThrow();
      await expect(
        client.watchProgress.create({
          data: {
            completed: false,
            durationSeconds: 100,
            lastWatchedAt: observedAt,
            movieId: movie.id,
            observedAt,
            positionSeconds: 101,
            userId: user.id,
          },
        }),
      ).rejects.toThrow();
      await expect(
        client.$executeRaw`
          INSERT INTO "watch_progress" (
            "user_id", "movie_id", "position_seconds", "duration_seconds",
            "completed", "observed_at", "last_watched_at", "updated_at"
          ) VALUES (
            ${user.id}::uuid, ${movie.id}::uuid, 'NaN'::double precision, 100,
            false, ${observedAt}, ${observedAt}, CURRENT_TIMESTAMP
          )
        `,
      ).rejects.toThrow();
      await expect(
        client.watchProgress.create({
          data: {
            completed: false,
            durationSeconds: 100,
            lastWatchedAt: observedAt,
            movieId: movie.id,
            observedAt,
            positionSeconds: 50,
            userId: user.id,
          },
        }),
      ).resolves.toMatchObject({ durationSeconds: 100, positionSeconds: 50 });
    } finally {
      await client.user.delete({ where: { id: user.id } });
    }
  });
});
