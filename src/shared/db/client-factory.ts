import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

export function createDatabaseClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({
    connectionString,
    connectionTimeoutMillis: 2_000,
    idleTimeoutMillis: 10_000,
    max: 5,
    statement_timeout: 2_000,
  });

  return new PrismaClient({ adapter });
}
