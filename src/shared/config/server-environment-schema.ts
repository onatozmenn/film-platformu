import { z } from "zod";

const postgresUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => value.startsWith("postgresql://") || value.startsWith("postgres://"), {
    message: "DATABASE_URL must use the PostgreSQL protocol",
  });

const optionalSecretSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().min(20).max(2_048).optional(),
);

const serverEnvironmentSchema = z
  .object({
    DATABASE_URL: postgresUrlSchema,
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    SITE_ORIGIN: z.url().default("http://localhost:3000"),
    TMDB_API_TOKEN: optionalSecretSchema,
    TMDB_ENABLED: z.enum(["true", "false"]).default("false"),
    TRUST_INCOMING_REQUEST_ID: z.enum(["true", "false"]).default("false"),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.TMDB_ENABLED === "true" && value.TMDB_API_TOKEN === undefined) {
      context.addIssue({
        code: "custom",
        message: "TMDB_API_TOKEN is required when TMDB_ENABLED is true",
        path: ["TMDB_API_TOKEN"],
      });
    }
  });

export type MetadataProviderEnvironment =
  Readonly<{ kind: "disabled" }> | Readonly<{ apiToken: string; kind: "tmdb" }>;

export type ServerEnvironment = Readonly<{
  databaseUrl: string;
  logLevel: "debug" | "info" | "warn" | "error";
  metadataProvider: MetadataProviderEnvironment;
  nodeEnvironment: "development" | "test" | "production";
  siteOrigin: string;
  trustIncomingRequestId: boolean;
}>;

export function parseServerEnvironment(source: {
  DATABASE_URL?: string | undefined;
  LOG_LEVEL?: string | undefined;
  NODE_ENV?: string | undefined;
  SITE_ORIGIN?: string | undefined;
  TMDB_API_TOKEN?: string | undefined;
  TMDB_ENABLED?: string | undefined;
  TRUST_INCOMING_REQUEST_ID?: string | undefined;
}): ServerEnvironment {
  const parsed = serverEnvironmentSchema.parse(source);
  let metadataProvider: MetadataProviderEnvironment = { kind: "disabled" };
  if (parsed.TMDB_ENABLED === "true") {
    if (parsed.TMDB_API_TOKEN === undefined) {
      throw new Error("TMDB configuration validation failed");
    }
    metadataProvider = { apiToken: parsed.TMDB_API_TOKEN, kind: "tmdb" };
  }

  return Object.freeze({
    databaseUrl: parsed.DATABASE_URL,
    logLevel: parsed.LOG_LEVEL,
    metadataProvider: Object.freeze(metadataProvider),
    nodeEnvironment: parsed.NODE_ENV,
    siteOrigin: parsed.SITE_ORIGIN.replace(/\/$/u, ""),
    trustIncomingRequestId: parsed.TRUST_INCOMING_REQUEST_ID === "true",
  });
}
