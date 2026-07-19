import type { PrismaClient } from "@/generated/prisma/client";

import type { RestoreVerificationSnapshot } from "./restore-verification";

type CountRow = Readonly<{ count: bigint }>;

function count(rows: readonly CountRow[]): number {
  const row = rows[0];
  if (row === undefined) throw new Error("Restore verification count was not returned");
  return Number(row.count);
}

export async function readRestoreVerificationSnapshot(
  client: PrismaClient,
  now: Date,
): Promise<RestoreVerificationSnapshot> {
  const [
    activeAdminCount,
    catalogMovieCount,
    publicationHistoryInvalidCount,
    invalidPendingDeletionRows,
    completedDeletionUserRows,
    dueDeletionRequestCount,
  ] = await Promise.all([
    client.userRole.count({
      where: {
        role: "ADMIN",
        user: { profile: { is: { deletedAt: null, disabledAt: null } } },
      },
    }),
    client.movie.count(),
    client.movie.count({
      where: {
        firstPublishedAt: null,
        publicationState: { in: ["PUBLISHED", "UNPUBLISHED"] },
      },
    }),
    client.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS count
      FROM account_deletion_requests AS request
      LEFT JOIN user_profiles AS profile ON profile.user_id = request.user_id
      WHERE request.completed_at IS NULL
        AND (
          profile.user_id IS NULL
          OR profile.disabled_at IS NULL
          OR profile.deleted_at IS NULL
        )
    `,
    client.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS count
      FROM account_deletion_requests AS request
      INNER JOIN users AS restored_user ON restored_user.id = request.user_id
      WHERE request.completed_at IS NOT NULL
    `,
    client.accountDeletionRequest.count({
      where: { completedAt: null, purgeAfter: { lte: now } },
    }),
  ]);

  return {
    activeAdminCount,
    catalogMovieCount,
    completedDeletionUsersRemaining: count(completedDeletionUserRows),
    dueDeletionRequestCount,
    invalidPendingDeletionRequestCount: count(invalidPendingDeletionRows),
    publicationHistoryInvalidCount,
  };
}
