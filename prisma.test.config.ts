import "dotenv/config";

import { defineConfig } from "prisma/config";

const localTestDatabaseUrl =
  "postgresql://film:film@127.0.0.1:54329/film_platform_test?schema=public";

function resolveTestDatabaseUrl(): string {
  const configuredUrl = process.env.TEST_DATABASE_URL ?? localTestDatabaseUrl;
  const databaseName = new URL(configuredUrl).pathname.slice(1);

  if (!databaseName.endsWith("_test")) {
    throw new Error("Test migrations require a database name ending in _test");
  }

  return configuredUrl;
}

export default defineConfig({
  datasource: {
    url: resolveTestDatabaseUrl(),
  },
  migrations: {
    path: "prisma/migrations",
  },
  schema: "prisma/schema.prisma",
});
