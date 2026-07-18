import "dotenv/config";

import { parseServerEnvironment } from "../src/shared/config/server-environment-schema";
import { createDatabaseClient } from "../src/shared/db/client-factory";

async function checkDatabase(): Promise<void> {
  const environment = parseServerEnvironment({
    DATABASE_URL: process.env.DATABASE_URL,
    LOG_LEVEL: process.env.LOG_LEVEL,
    NODE_ENV: process.env.NODE_ENV,
    TRUST_INCOMING_REQUEST_ID: process.env.TRUST_INCOMING_REQUEST_ID,
  });
  const client = createDatabaseClient(environment.databaseUrl);

  try {
    await client.$queryRaw`SELECT 1`;
    process.stdout.write("Database connection and migration state are ready.\n");
  } finally {
    await client.$disconnect();
  }
}

void checkDatabase().catch((error: unknown) => {
  const errorName = error instanceof Error ? error.name : "UnknownError";
  process.stderr.write(`Database check failed: ${errorName}\n`);
  process.exitCode = 1;
});
