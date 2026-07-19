import type { PrismaClient } from "@/generated/prisma/client";
import { hasDatabaseErrorCode } from "@/shared/db/database-error";

import type {
  AccountDeletionWriteResult,
  AccountLifecycleRepositoryPort,
  RetentionRunResult,
} from "../application/account-lifecycle-port";
import { accountDeletionWindowMilliseconds } from "../domain/account-deletion-policy";

const maximumSerializationAttempts = 3;

export function createPrismaAccountLifecycleRepository(
  client: PrismaClient,
): AccountLifecycleRepositoryPort {
  return {
    async requestDeletion(userId, requestedAt, purgeAfter) {
      for (let attempt = 1; attempt <= maximumSerializationAttempts; attempt += 1) {
        try {
          return await client.$transaction<AccountDeletionWriteResult>(
            async (transaction) => {
              const profile = await transaction.userProfile.findUnique({
                where: { userId },
                include: {
                  user: {
                    select: {
                      email: true,
                      roles: { where: { role: "ADMIN" }, select: { role: true } },
                    },
                  },
                },
              });
              if (profile === null) {
                return "not-found";
              }
              if (profile.deletedAt !== null || profile.disabledAt !== null) {
                return "already-requested";
              }
              if (profile.user.roles.length > 0) {
                const activeAdmins = await transaction.userRole.count({
                  where: {
                    role: "ADMIN",
                    user: { profile: { is: { deletedAt: null, disabledAt: null } } },
                  },
                });
                if (activeAdmins <= 1) {
                  return "final-admin";
                }
              }

              await transaction.userProfile.update({
                where: { userId },
                data: { deletedAt: requestedAt, disabledAt: requestedAt },
              });
              await transaction.session.deleteMany({ where: { userId } });
              if (profile.user.email !== null) {
                await transaction.verificationToken.deleteMany({
                  where: { identifier: profile.user.email },
                });
              }
              await transaction.accountDeletionRequest.upsert({
                where: { userId },
                create: { purgeAfter, requestedAt, userId },
                update: {},
              });
              return "requested";
            },
            { isolationLevel: "Serializable", maxWait: 2_000, timeout: 5_000 },
          );
        } catch (error) {
          if (
            attempt < maximumSerializationAttempts &&
            hasDatabaseErrorCode(error, "P2034", "40001")
          ) {
            continue;
          }
          throw error;
        }
      }
      throw new Error("Account deletion serialization attempts exhausted");
    },

    async purgeDueAccounts(now, limit): Promise<RetentionRunResult> {
      const deletedBefore = new Date(now.getTime() - accountDeletionWindowMilliseconds);
      const candidates = await client.$queryRaw<Array<{ userId: string }>>`
        SELECT request.user_id AS "userId"
        FROM account_deletion_requests AS request
        INNER JOIN users AS member ON member.id = request.user_id
        INNER JOIN user_profiles AS profile ON profile.user_id = member.id
        WHERE request.purge_after <= ${now}
          AND profile.deleted_at IS NOT NULL
          AND profile.deleted_at <= ${deletedBefore}
        ORDER BY request.purge_after ASC, request.user_id ASC
        LIMIT ${limit}
      `;
      let purged = 0;
      let skipped = 0;
      let failed = 0;

      for (const candidate of candidates) {
        try {
          const didPurge = await client.$transaction(async (transaction) => {
            const claimed = await transaction.$queryRaw<Array<{ email: string | null }>>`
              SELECT member.email
              FROM account_deletion_requests AS request
              INNER JOIN users AS member ON member.id = request.user_id
              INNER JOIN user_profiles AS profile ON profile.user_id = member.id
              WHERE request.user_id = ${candidate.userId}::uuid
                AND request.purge_after <= ${now}
                AND profile.deleted_at IS NOT NULL
                AND profile.deleted_at <= ${deletedBefore}
              FOR UPDATE OF request SKIP LOCKED
            `;
            const row = claimed[0];
            if (row === undefined) {
              return false;
            }
            if (row.email !== null) {
              await transaction.verificationToken.deleteMany({
                where: { identifier: row.email },
              });
            }
            await transaction.user.deleteMany({ where: { id: candidate.userId } });
            await transaction.accountDeletionRequest.updateMany({
              where: { completedAt: null, userId: candidate.userId },
              data: { completedAt: now },
            });
            return true;
          });
          if (didPurge) {
            purged += 1;
          } else {
            skipped += 1;
          }
        } catch {
          failed += 1;
        }
      }

      return { examined: candidates.length, failed, purged, skipped };
    },
  };
}
