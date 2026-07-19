import { z } from "zod";

export type InternalJobsEnvironment =
  | Readonly<{
      kind: "disabled";
      nodeEnvironment: "development" | "production" | "test";
    }>
  | Readonly<{
      batchLimit: number;
      cronSecret: string;
      kind: "enabled";
      nodeEnvironment: "development" | "production" | "test";
      publicationBatchLimit: number;
    }>;

const schema = z
  .object({
    CRON_SECRET: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().trim().min(32).max(256).optional(),
    ),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PUBLISH_BATCH_LIMIT: z.coerce.number().int().min(1).max(100).default(25),
    RETENTION_BATCH_LIMIT: z.coerce.number().int().min(1).max(500).default(100),
  })
  .strict();

export function parseInternalJobsEnvironment(source: {
  CRON_SECRET?: string | undefined;
  NODE_ENV?: string | undefined;
  PUBLISH_BATCH_LIMIT?: string | undefined;
  RETENTION_BATCH_LIMIT?: string | undefined;
}): InternalJobsEnvironment {
  const parsed = schema.parse(source);
  return parsed.CRON_SECRET === undefined
    ? { kind: "disabled", nodeEnvironment: parsed.NODE_ENV }
    : {
        batchLimit: parsed.RETENTION_BATCH_LIMIT,
        cronSecret: parsed.CRON_SECRET,
        kind: "enabled",
        nodeEnvironment: parsed.NODE_ENV,
        publicationBatchLimit: parsed.PUBLISH_BATCH_LIMIT,
      };
}
