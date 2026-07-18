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
const optionalProviderSecretSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().min(8).max(16_384).optional(),
);
const territorySchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{2}$/u);
const supportedTerritoriesSchema = z
  .string()
  .default("TR")
  .transform((value) => [...new Set(value.split(",").map((entry) => entry.trim()))])
  .pipe(z.array(territorySchema).min(1).max(32));

const serverEnvironmentSchema = z
  .object({
    DATABASE_URL: postgresUrlSchema,
    LOCAL_DEFAULT_TERRITORY: z.preprocess(
      (value) => (value === "" ? undefined : value),
      territorySchema.optional(),
    ),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    MUX_SIGNING_KEY_ID: optionalProviderSecretSchema,
    MUX_SIGNING_PRIVATE_KEY: optionalProviderSecretSchema,
    MUX_TOKEN_ID: optionalProviderSecretSchema,
    MUX_TOKEN_SECRET: optionalProviderSecretSchema,
    MUX_WEBHOOK_SECRET: optionalProviderSecretSchema,
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    SITE_ORIGIN: z.url().default("http://localhost:3000"),
    SUPPORTED_TERRITORIES: supportedTerritoriesSchema,
    TMDB_API_TOKEN: optionalSecretSchema,
    TMDB_ENABLED: z.enum(["true", "false"]).default("false"),
    TRUST_INCOMING_REQUEST_ID: z.enum(["true", "false"]).default("false"),
    VIDEO_PROVIDER: z.enum(["fake", "mux"]).default("fake"),
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
    if (
      value.LOCAL_DEFAULT_TERRITORY !== undefined &&
      !value.SUPPORTED_TERRITORIES.includes(value.LOCAL_DEFAULT_TERRITORY)
    ) {
      context.addIssue({
        code: "custom",
        message: "LOCAL_DEFAULT_TERRITORY must be included in SUPPORTED_TERRITORIES",
        path: ["LOCAL_DEFAULT_TERRITORY"],
      });
    }
    if (value.NODE_ENV === "production" && value.LOCAL_DEFAULT_TERRITORY !== undefined) {
      context.addIssue({
        code: "custom",
        message: "LOCAL_DEFAULT_TERRITORY is forbidden in production",
        path: ["LOCAL_DEFAULT_TERRITORY"],
      });
    }
    if (value.VIDEO_PROVIDER === "mux") {
      for (const field of [
        "MUX_SIGNING_KEY_ID",
        "MUX_SIGNING_PRIVATE_KEY",
        "MUX_TOKEN_ID",
        "MUX_TOKEN_SECRET",
        "MUX_WEBHOOK_SECRET",
      ] as const) {
        if (value[field] === undefined) {
          context.addIssue({
            code: "custom",
            message: `${field} is required when VIDEO_PROVIDER is mux`,
            path: [field],
          });
        }
      }
    }
  });

export type MetadataProviderEnvironment =
  Readonly<{ kind: "disabled" }> | Readonly<{ apiToken: string; kind: "tmdb" }>;

export type VideoProviderEnvironment =
  | Readonly<{ kind: "fake" }>
  | Readonly<{
      kind: "mux";
      signingKeyId: string;
      signingPrivateKey: string;
      tokenId: string;
      tokenSecret: string;
      webhookSecret: string;
    }>;

export type ServerEnvironment = Readonly<{
  databaseUrl: string;
  logLevel: "debug" | "info" | "warn" | "error";
  metadataProvider: MetadataProviderEnvironment;
  nodeEnvironment: "development" | "test" | "production";
  playback: Readonly<{
    localDefaultTerritory: string | null;
    supportedTerritories: readonly string[];
    videoProvider: VideoProviderEnvironment;
  }>;
  siteOrigin: string;
  trustIncomingRequestId: boolean;
}>;

export function parseServerEnvironment(source: {
  DATABASE_URL?: string | undefined;
  LOCAL_DEFAULT_TERRITORY?: string | undefined;
  LOG_LEVEL?: string | undefined;
  MUX_SIGNING_KEY_ID?: string | undefined;
  MUX_SIGNING_PRIVATE_KEY?: string | undefined;
  MUX_TOKEN_ID?: string | undefined;
  MUX_TOKEN_SECRET?: string | undefined;
  MUX_WEBHOOK_SECRET?: string | undefined;
  NODE_ENV?: string | undefined;
  SITE_ORIGIN?: string | undefined;
  SUPPORTED_TERRITORIES?: string | undefined;
  TMDB_API_TOKEN?: string | undefined;
  TMDB_ENABLED?: string | undefined;
  TRUST_INCOMING_REQUEST_ID?: string | undefined;
  VIDEO_PROVIDER?: string | undefined;
}): ServerEnvironment {
  const parsed = serverEnvironmentSchema.parse(source);
  let metadataProvider: MetadataProviderEnvironment = { kind: "disabled" };
  if (parsed.TMDB_ENABLED === "true") {
    if (parsed.TMDB_API_TOKEN === undefined) {
      throw new Error("TMDB configuration validation failed");
    }
    metadataProvider = { apiToken: parsed.TMDB_API_TOKEN, kind: "tmdb" };
  }
  let videoProvider: VideoProviderEnvironment = { kind: "fake" };
  if (parsed.VIDEO_PROVIDER === "mux") {
    const requireProviderValue = (value: string | undefined): string => {
      if (value === undefined) {
        throw new Error("Mux configuration validation failed");
      }
      return value;
    };
    videoProvider = {
      kind: "mux",
      signingKeyId: requireProviderValue(parsed.MUX_SIGNING_KEY_ID),
      signingPrivateKey: requireProviderValue(parsed.MUX_SIGNING_PRIVATE_KEY).replaceAll(
        "\\n",
        "\n",
      ),
      tokenId: requireProviderValue(parsed.MUX_TOKEN_ID),
      tokenSecret: requireProviderValue(parsed.MUX_TOKEN_SECRET),
      webhookSecret: requireProviderValue(parsed.MUX_WEBHOOK_SECRET),
    };
  }

  return Object.freeze({
    databaseUrl: parsed.DATABASE_URL,
    logLevel: parsed.LOG_LEVEL,
    metadataProvider: Object.freeze(metadataProvider),
    nodeEnvironment: parsed.NODE_ENV,
    playback: Object.freeze({
      localDefaultTerritory: parsed.LOCAL_DEFAULT_TERRITORY ?? null,
      supportedTerritories: Object.freeze(parsed.SUPPORTED_TERRITORIES),
      videoProvider: Object.freeze(videoProvider),
    }),
    siteOrigin: parsed.SITE_ORIGIN.replace(/\/$/u, ""),
    trustIncomingRequestId: parsed.TRUST_INCOMING_REQUEST_ID === "true",
  });
}
