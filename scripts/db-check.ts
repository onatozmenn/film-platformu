import "dotenv/config";

import { ZodError } from "zod";

import { parseServerEnvironment } from "../src/shared/config/server-environment-schema";
import { createDatabaseClient } from "../src/shared/db/client-factory";

const localDatabaseUrl = "postgresql://film:film@127.0.0.1:54329/film_platform?schema=public";

function resolveDatabaseUrl(): string | undefined {
  const configured = process.env.DATABASE_URL;
  if (configured !== undefined && configured.length > 0) return configured;
  return process.env.NODE_ENV === "production" ? undefined : localDatabaseUrl;
}

async function checkDatabase(): Promise<void> {
  const environment = parseServerEnvironment({
    DATABASE_URL: resolveDatabaseUrl(),
    LOCAL_DEFAULT_TERRITORY: process.env.LOCAL_DEFAULT_TERRITORY,
    LOG_LEVEL: process.env.LOG_LEVEL,
    MUX_SIGNING_KEY_ID: process.env.MUX_SIGNING_KEY_ID,
    MUX_SIGNING_PRIVATE_KEY: process.env.MUX_SIGNING_PRIVATE_KEY,
    MUX_TOKEN_ID: process.env.MUX_TOKEN_ID,
    MUX_TOKEN_SECRET: process.env.MUX_TOKEN_SECRET,
    MUX_WEBHOOK_SECRET: process.env.MUX_WEBHOOK_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    RELEASE_ID: process.env.RELEASE_ID,
    SITE_ORIGIN: process.env.SITE_ORIGIN,
    SUPPORTED_TERRITORIES: process.env.SUPPORTED_TERRITORIES,
    TMDB_API_TOKEN: process.env.TMDB_API_TOKEN,
    TMDB_ENABLED: process.env.TMDB_ENABLED,
    TRUST_INCOMING_REQUEST_ID: process.env.TRUST_INCOMING_REQUEST_ID,
    VIDEO_PROVIDER: process.env.VIDEO_PROVIDER,
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
  if (error instanceof ZodError) {
    const paths = [...new Set(error.issues.map((issue) => issue.path.join(".") || "environment"))];
    process.stderr.write(`Database check configuration invalid: ${paths.join(", ")}\n`);
    process.exitCode = 1;
    return;
  }
  const errorName = error instanceof Error ? error.name : "UnknownError";
  process.stderr.write(`Database check failed: ${errorName}\n`);
  process.exitCode = 1;
});
