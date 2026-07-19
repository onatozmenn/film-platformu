import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { ActionResult } from "@/shared/application/action-result";
import { hasDatabaseErrorCode } from "@/shared/db/database-error";

import type { AdminCommandRepositoryPort } from "../application/admin-command-port";
import { appendAuditEvent, isAuthorized } from "./prisma-admin-command-support";

type AdminIdentityMethods = Pick<
  AdminCommandRepositoryPort,
  "disableAccount" | "grantRole" | "revokeRole"
>;

type AdminIdentityOptions = Readonly<{ clock: () => Date }>;

const maximumSerializationAttempts = 3;
const serializableOptions = {
  isolationLevel: "Serializable",
  maxWait: 2_000,
  timeout: 5_000,
} as const;

async function runSerializable<T>(
  client: PrismaClient,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= maximumSerializationAttempts; attempt += 1) {
    try {
      return await client.$transaction(operation, serializableOptions);
    } catch (error) {
      if (attempt < maximumSerializationAttempts && hasDatabaseErrorCode(error, "P2034", "40001")) {
        continue;
      }
      throw error;
    }
  }
  throw new Error("Admin identity serialization attempts exhausted");
}

async function activeAdminCount(transaction: Prisma.TransactionClient): Promise<number> {
  return transaction.userRole.count({
    where: {
      role: "ADMIN",
      user: { profile: { is: { deletedAt: null, disabledAt: null } } },
    },
  });
}

export function createPrismaAdminIdentityCommands(
  client: PrismaClient,
  options: AdminIdentityOptions,
): AdminIdentityMethods {
  return {
    async disableAccount(command) {
      return runSerializable<ActionResult<Readonly<{ userId: string }>>>(
        client,
        async (transaction) => {
          if (!(await isAuthorized(transaction, command.actorUserId, "DISABLE_ACCOUNTS"))) {
            return { code: "FORBIDDEN", ok: false };
          }
          const profile = await transaction.userProfile.findUnique({
            where: { userId: command.subjectUserId },
            select: {
              deletedAt: true,
              disabledAt: true,
              user: {
                select: {
                  email: true,
                  roles: { where: { role: "ADMIN" }, select: { role: true } },
                },
              },
            },
          });
          if (profile === null || profile.deletedAt !== null) {
            return { code: "NOT_FOUND", ok: false };
          }
          if (profile.disabledAt !== null) {
            return { data: { userId: command.subjectUserId }, ok: true };
          }
          if (profile.user.roles.length > 0 && (await activeAdminCount(transaction)) <= 1) {
            return { code: "CONFLICT", ok: false };
          }
          const disabledAt = options.clock();
          await transaction.userProfile.update({
            where: { userId: command.subjectUserId },
            data: { disabledAt },
          });
          await transaction.session.deleteMany({ where: { userId: command.subjectUserId } });
          if (profile.user.email !== null) {
            await transaction.verificationToken.deleteMany({
              where: { identifier: profile.user.email },
            });
          }
          await appendAuditEvent(transaction, {
            action: "ACCOUNT_DISABLED",
            actorUserId: command.actorUserId,
            metadata: { disabledAt: disabledAt.toISOString() },
            requestId: command.requestId,
            targetId: command.subjectUserId,
            targetType: "USER",
          });
          return { data: { userId: command.subjectUserId }, ok: true };
        },
      );
    },

    async grantRole(command) {
      return runSerializable<ActionResult<Readonly<{ userId: string }>>>(
        client,
        async (transaction) => {
          if (!(await isAuthorized(transaction, command.actorUserId, "MANAGE_ROLES"))) {
            return { code: "FORBIDDEN", ok: false };
          }
          const profile = await transaction.userProfile.findUnique({
            where: { userId: command.subjectUserId },
            select: { deletedAt: true, disabledAt: true },
          });
          if (profile === null || profile.deletedAt !== null || profile.disabledAt !== null) {
            return { code: "NOT_FOUND", ok: false };
          }
          const existing = await transaction.userRole.findUnique({
            where: { userId_role: { role: command.role, userId: command.subjectUserId } },
            select: { role: true },
          });
          if (existing !== null) {
            return { data: { userId: command.subjectUserId }, ok: true };
          }
          await transaction.userRole.create({
            data: {
              grantedBy: command.actorUserId,
              role: command.role,
              userId: command.subjectUserId,
            },
          });
          await transaction.session.deleteMany({ where: { userId: command.subjectUserId } });
          await appendAuditEvent(transaction, {
            action: "ROLE_GRANTED",
            actorUserId: command.actorUserId,
            metadata: { role: command.role },
            requestId: command.requestId,
            targetId: command.subjectUserId,
            targetType: "USER",
          });
          return { data: { userId: command.subjectUserId }, ok: true };
        },
      );
    },

    async revokeRole(command) {
      return runSerializable<ActionResult<Readonly<{ userId: string }>>>(
        client,
        async (transaction) => {
          if (!(await isAuthorized(transaction, command.actorUserId, "MANAGE_ROLES"))) {
            return { code: "FORBIDDEN", ok: false };
          }
          const profile = await transaction.userProfile.findUnique({
            where: { userId: command.subjectUserId },
            select: { deletedAt: true, disabledAt: true },
          });
          if (profile === null || profile.deletedAt !== null) {
            return { code: "NOT_FOUND", ok: false };
          }
          const existing = await transaction.userRole.findUnique({
            where: { userId_role: { role: command.role, userId: command.subjectUserId } },
            select: { role: true },
          });
          if (existing === null) {
            return { data: { userId: command.subjectUserId }, ok: true };
          }
          if (
            command.role === "ADMIN" &&
            profile.disabledAt === null &&
            (await activeAdminCount(transaction)) <= 1
          ) {
            return { code: "CONFLICT", ok: false };
          }
          await transaction.userRole.delete({
            where: { userId_role: { role: command.role, userId: command.subjectUserId } },
          });
          await transaction.session.deleteMany({ where: { userId: command.subjectUserId } });
          await appendAuditEvent(transaction, {
            action: "ROLE_REVOKED",
            actorUserId: command.actorUserId,
            metadata: { role: command.role },
            requestId: command.requestId,
            targetId: command.subjectUserId,
            targetType: "USER",
          });
          return { data: { userId: command.subjectUserId }, ok: true };
        },
      );
    },
  };
}
