import { createDatabaseClient } from "@/shared/db/client-factory";
import { readRestoreVerificationSnapshot } from "@/shared/release/prisma-restore-verification";
import {
  assertIsolatedRestoreDatabaseUrl,
  evaluateRestoreVerification,
} from "@/shared/release/restore-verification";

async function main(): Promise<void> {
  const databaseUrl = assertIsolatedRestoreDatabaseUrl(process.env.RESTORE_DATABASE_URL);
  const client = createDatabaseClient(databaseUrl);
  try {
    const snapshot = await readRestoreVerificationSnapshot(client, new Date());
    const decision = evaluateRestoreVerification(snapshot);
    const report = {
      issues: decision.ready ? [] : decision.issues,
      ready: decision.ready,
      snapshot,
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!decision.ready) process.exitCode = 1;
  } finally {
    await client.$disconnect();
  }
}

void main().catch(() => {
  process.stderr.write("Restore verification could not complete.\n");
  process.exitCode = 1;
});
