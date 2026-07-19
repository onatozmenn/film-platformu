import type { PrismaClient } from "@/generated/prisma/client";

import type { MemberAuthorizationPort } from "../application/member-authorization-port";

export function createPrismaMemberAuthorization(client: PrismaClient): MemberAuthorizationPort {
  return {
    async isActiveMember(userId) {
      const profile = await client.userProfile.findFirst({
        where: {
          deletedAt: null,
          disabledAt: null,
          user: { roles: { some: { role: "MEMBER" } } },
          userId,
        },
        select: { userId: true },
      });
      return profile !== null;
    },
  };
}
