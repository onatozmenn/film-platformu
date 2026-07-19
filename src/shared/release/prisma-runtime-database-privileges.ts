import type { PrismaClient } from "@/generated/prisma/client";

import type { RuntimeDatabasePrivilegeSnapshot } from "./runtime-database-privileges";

type PrivilegeRow = Readonly<{
  canCreateSchemaObjects: boolean;
  ownedTableCount: bigint;
  superuser: boolean;
}>;

export async function readRuntimeDatabasePrivilegeSnapshot(
  client: PrismaClient,
): Promise<RuntimeDatabasePrivilegeSnapshot> {
  const rows = await client.$queryRaw<PrivilegeRow[]>`
    SELECT
      has_schema_privilege(current_user, current_schema(), 'CREATE') AS "canCreateSchemaObjects",
      (
        SELECT COUNT(*)::bigint
        FROM pg_tables
        WHERE schemaname = current_schema()
          AND tableowner = current_user
      ) AS "ownedTableCount",
      COALESCE((SELECT rolsuper FROM pg_roles WHERE rolname = current_user), false) AS superuser
  `;
  const row = rows[0];
  if (row === undefined) throw new Error("Runtime database privilege snapshot was not returned");
  return {
    canCreateSchemaObjects: row.canCreateSchemaObjects,
    ownedTableCount: Number(row.ownedTableCount),
    superuser: row.superuser,
  };
}
