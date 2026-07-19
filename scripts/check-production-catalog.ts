import { readProductionCatalogAuditSnapshot } from "@/modules/admin/infrastructure/prisma-production-catalog-audit";
import { evaluateProductionCatalogAudit } from "@/modules/admin/application/production-catalog-audit";
import { parseServerEnvironment } from "@/shared/config/server-environment-schema";
import { createDatabaseClient } from "@/shared/db/client-factory";

async function main(): Promise<void> {
  const environment = parseServerEnvironment({
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    SITE_ORIGIN: process.env.SITE_ORIGIN,
    SUPPORTED_TERRITORIES: process.env.SUPPORTED_TERRITORIES,
  });
  const client = createDatabaseClient(environment.databaseUrl);
  try {
    const snapshot = await readProductionCatalogAuditSnapshot(
      client,
      new Date(),
      environment.playback.supportedTerritories,
    );
    const decision = evaluateProductionCatalogAudit(snapshot);
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
  process.stderr.write("Production catalog audit could not complete.\n");
  process.exitCode = 1;
});
