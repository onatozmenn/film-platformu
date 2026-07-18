import { z } from "zod";

const postgresUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => value.startsWith("postgresql://") || value.startsWith("postgres://"), {
    message: "DATABASE_URL must use the PostgreSQL protocol",
  });

const serverEnvironmentSchema = z
  .object({
    DATABASE_URL: postgresUrlSchema,
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    TRUST_INCOMING_REQUEST_ID: z.enum(["true", "false"]).default("false"),
  })
  .strict();

export type ServerEnvironment = Readonly<{
  databaseUrl: string;
  logLevel: "debug" | "info" | "warn" | "error";
  nodeEnvironment: "development" | "test" | "production";
  trustIncomingRequestId: boolean;
}>;

export function parseServerEnvironment(source: {
  DATABASE_URL?: string | undefined;
  LOG_LEVEL?: string | undefined;
  NODE_ENV?: string | undefined;
  TRUST_INCOMING_REQUEST_ID?: string | undefined;
}): ServerEnvironment {
  const parsed = serverEnvironmentSchema.parse(source);

  return Object.freeze({
    databaseUrl: parsed.DATABASE_URL,
    logLevel: parsed.LOG_LEVEL,
    nodeEnvironment: parsed.NODE_ENV,
    trustIncomingRequestId: parsed.TRUST_INCOMING_REQUEST_ID === "true",
  });
}
