import "dotenv/config";

import { defineConfig } from "prisma/config";

const localDatabaseUrl = "postgresql://film:film@127.0.0.1:54329/film_platform?schema=public";

function resolveDatabaseUrl(): string {
  const configuredUrl = process.env.DATABASE_URL;

  if (configuredUrl !== undefined && configuredUrl.length > 0) {
    return configuredUrl;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required for production database commands");
  }

  return localDatabaseUrl;
}

export default defineConfig({
  datasource: {
    url: resolveDatabaseUrl(),
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  schema: "prisma/schema.prisma",
});
