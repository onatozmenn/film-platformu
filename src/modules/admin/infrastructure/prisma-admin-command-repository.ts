import type { PrismaClient } from "@/generated/prisma/client";

import type { AdminCommandRepositoryPort } from "../application/admin-command-port";
import { createPrismaAdminIdentityCommands } from "./prisma-admin-identity-commands";
import { createPrismaCatalogAdminCommands } from "./prisma-catalog-admin-commands";
import { createPrismaPublicationCommands } from "./prisma-publication-commands";
import { createPrismaPublishDue } from "./prisma-publish-due";

type AdminRepositoryOptions = Readonly<{
  clock: () => Date;
  supportedTerritories: readonly string[];
}>;

export function createPrismaAdminCommandRepository(
  client: PrismaClient,
  options: AdminRepositoryOptions,
): AdminCommandRepositoryPort {
  return {
    ...createPrismaPublicationCommands(client, options),
    ...createPrismaCatalogAdminCommands(client, options),
    ...createPrismaAdminIdentityCommands(client, options),
    ...createPrismaPublishDue(client, options),
  };
}
