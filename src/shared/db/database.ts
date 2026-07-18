import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { getServerEnvironment } from "@/shared/config/server-environment";

import { createDatabaseClient } from "./client-factory";

declare global {
  var filmPlatformDatabase: PrismaClient | undefined;
}

export const database =
  globalThis.filmPlatformDatabase ?? createDatabaseClient(getServerEnvironment().databaseUrl);

if (getServerEnvironment().nodeEnvironment !== "production") {
  globalThis.filmPlatformDatabase = database;
}
