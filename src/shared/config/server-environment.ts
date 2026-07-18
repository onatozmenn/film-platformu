import "server-only";

import { parseServerEnvironment, type ServerEnvironment } from "./server-environment-schema";

let cachedEnvironment: ServerEnvironment | undefined;

export function getServerEnvironment(): ServerEnvironment {
  cachedEnvironment ??= parseServerEnvironment({
    DATABASE_URL: process.env.DATABASE_URL,
    LOG_LEVEL: process.env.LOG_LEVEL,
    NODE_ENV: process.env.NODE_ENV,
    SITE_ORIGIN: process.env.SITE_ORIGIN,
    TMDB_API_TOKEN: process.env.TMDB_API_TOKEN,
    TMDB_ENABLED: process.env.TMDB_ENABLED,
    TRUST_INCOMING_REQUEST_ID: process.env.TRUST_INCOMING_REQUEST_ID,
  });

  return cachedEnvironment;
}
