import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { Adapter, AdapterUser } from "next-auth/adapters";

import type { PrismaClient } from "@/generated/prisma/client";

function displayNameFor(user: Omit<AdapterUser, "id">): string {
  const name = user.name?.trim();
  return name === undefined || name.length === 0 ? "Film üyesi" : name.slice(0, 80);
}

export function createIdentityAdapter(client: PrismaClient): Adapter {
  const adapter = PrismaAdapter(client);

  return {
    ...adapter,
    async createUser(user: Omit<AdapterUser, "id">): Promise<AdapterUser> {
      return client.$transaction(async (transaction) => {
        const created = await transaction.user.create({
          data: {
            email: user.email.trim().toLowerCase(),
            emailVerified: user.emailVerified,
            ...(user.image === undefined ? {} : { image: user.image }),
            ...(user.name === undefined ? {} : { name: user.name }),
          },
        });
        await transaction.userProfile.create({
          data: { displayName: displayNameFor(user), userId: created.id },
        });
        await transaction.userRole.create({
          data: { grantedBy: created.id, role: "MEMBER", userId: created.id },
        });

        return {
          email: created.email ?? user.email,
          emailVerified: created.emailVerified,
          id: created.id,
          image: created.image,
          name: created.name,
        };
      });
    },
  };
}
