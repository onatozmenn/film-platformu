import { parseServerEnvironment } from "@/shared/config/server-environment-schema";
import { createDatabaseClient } from "@/shared/db/client-factory";
import { readRuntimeDatabasePrivilegeSnapshot } from "@/shared/release/prisma-runtime-database-privileges";
import { evaluateRuntimeDatabasePrivileges } from "@/shared/release/runtime-database-privileges";

async function main(): Promise<void> {
  const environment = parseServerEnvironment({
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    RELEASE_ID: process.env.RELEASE_ID,
    SITE_ORIGIN: process.env.SITE_ORIGIN,
  });
  const client = createDatabaseClient(environment.databaseUrl);
  try {
    const snapshot = await readRuntimeDatabasePrivilegeSnapshot(client);
    const decision = evaluateRuntimeDatabasePrivileges(snapshot);
    process.stdout.write(
      `${JSON.stringify(
        {
          issues: decision.ready ? [] : decision.issues,
          ready: decision.ready,
          snapshot,
        },
        null,
        2,
      )}\n`,
    );
    if (!decision.ready) process.exitCode = 1;
  } finally {
    await client.$disconnect();
  }
}

void main().catch(() => {
  process.stderr.write("Runtime database privilege check could not complete.\n");
  process.exitCode = 1;
});
