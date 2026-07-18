import "server-only";

import { parseServerEnvironment, type ServerEnvironment } from "./server-environment-schema";

let cachedEnvironment: ServerEnvironment | undefined;

export function getServerEnvironment(): ServerEnvironment {
  cachedEnvironment ??= parseServerEnvironment({
    DATABASE_URL: process.env.DATABASE_URL,
    LOCAL_DEFAULT_TERRITORY: process.env.LOCAL_DEFAULT_TERRITORY,
    LOG_LEVEL: process.env.LOG_LEVEL,
    MUX_SIGNING_KEY_ID: process.env.MUX_SIGNING_KEY_ID,
    MUX_SIGNING_PRIVATE_KEY: process.env.MUX_SIGNING_PRIVATE_KEY,
    MUX_TOKEN_ID: process.env.MUX_TOKEN_ID,
    MUX_TOKEN_SECRET: process.env.MUX_TOKEN_SECRET,
    MUX_WEBHOOK_SECRET: process.env.MUX_WEBHOOK_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    SITE_ORIGIN: process.env.SITE_ORIGIN,
    SUPPORTED_TERRITORIES: process.env.SUPPORTED_TERRITORIES,
    TMDB_API_TOKEN: process.env.TMDB_API_TOKEN,
    TMDB_ENABLED: process.env.TMDB_ENABLED,
    TRUST_INCOMING_REQUEST_ID: process.env.TRUST_INCOMING_REQUEST_ID,
    VIDEO_PROVIDER: process.env.VIDEO_PROVIDER,
  });

  return cachedEnvironment;
}
