import { z } from "zod";

const optionalSecretSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(32).max(2_048).optional(),
);
const optionalEmailSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.email().trim().toLowerCase().max(320).optional(),
);
const optionalSmtpUrlSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .string()
    .trim()
    .max(2_048)
    .refine((value) => {
      try {
        const protocol = new URL(value).protocol;
        return protocol === "smtp:" || protocol === "smtps:";
      } catch {
        return false;
      }
    }, "AUTH_SMTP_URL must use smtp: or smtps:")
    .optional(),
);

const identityEnvironmentSchema = z
  .object({
    AUTH_EMAIL_FROM: optionalEmailSchema,
    AUTH_EMAIL_PROVIDER: z.enum(["disabled", "fake", "smtp"]).default("disabled"),
    AUTH_SECRET: optionalSecretSchema,
    AUTH_SMTP_URL: optionalSmtpUrlSchema,
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.AUTH_EMAIL_PROVIDER !== "disabled") {
      if (value.AUTH_SECRET === undefined) {
        context.addIssue({
          code: "custom",
          message: "AUTH_SECRET is required when email authentication is enabled",
          path: ["AUTH_SECRET"],
        });
      }
      if (value.AUTH_EMAIL_FROM === undefined) {
        context.addIssue({
          code: "custom",
          message: "AUTH_EMAIL_FROM is required when email authentication is enabled",
          path: ["AUTH_EMAIL_FROM"],
        });
      }
    }
    if (value.NODE_ENV === "production" && value.AUTH_EMAIL_PROVIDER === "fake") {
      context.addIssue({
        code: "custom",
        message: "The fake email provider is forbidden in production",
        path: ["AUTH_EMAIL_PROVIDER"],
      });
    }
    if (value.AUTH_EMAIL_PROVIDER === "smtp" && value.AUTH_SMTP_URL === undefined) {
      context.addIssue({
        code: "custom",
        message: "AUTH_SMTP_URL is required when AUTH_EMAIL_PROVIDER is smtp",
        path: ["AUTH_SMTP_URL"],
      });
    }
    if (value.AUTH_EMAIL_PROVIDER !== "smtp" && value.AUTH_SMTP_URL !== undefined) {
      context.addIssue({
        code: "custom",
        message: "AUTH_SMTP_URL requires AUTH_EMAIL_PROVIDER=smtp",
        path: ["AUTH_SMTP_URL"],
      });
    }
  });

type EnabledEmailEnvironment = Readonly<{
  from: string;
  secret: string;
}>;

export type IdentityEnvironment = Readonly<{
  nodeEnvironment: "development" | "test" | "production";
  provider:
    | Readonly<{ kind: "disabled" }>
    | (EnabledEmailEnvironment & Readonly<{ kind: "fake" }>)
    | (EnabledEmailEnvironment & Readonly<{ kind: "smtp"; server: string }>);
}>;

function requireEnabledValue(value: string | undefined): string {
  if (value === undefined) {
    throw new Error("Identity configuration validation failed");
  }
  return value;
}

export function parseIdentityEnvironment(source: {
  AUTH_EMAIL_FROM?: string | undefined;
  AUTH_EMAIL_PROVIDER?: string | undefined;
  AUTH_SECRET?: string | undefined;
  AUTH_SMTP_URL?: string | undefined;
  NODE_ENV?: string | undefined;
}): IdentityEnvironment {
  const parsed = identityEnvironmentSchema.parse(source);
  let provider: IdentityEnvironment["provider"] = { kind: "disabled" };
  if (parsed.AUTH_EMAIL_PROVIDER === "fake") {
    provider = {
      from: requireEnabledValue(parsed.AUTH_EMAIL_FROM),
      kind: "fake",
      secret: requireEnabledValue(parsed.AUTH_SECRET),
    };
  }
  if (parsed.AUTH_EMAIL_PROVIDER === "smtp") {
    provider = {
      from: requireEnabledValue(parsed.AUTH_EMAIL_FROM),
      kind: "smtp",
      secret: requireEnabledValue(parsed.AUTH_SECRET),
      server: requireEnabledValue(parsed.AUTH_SMTP_URL),
    };
  }

  return Object.freeze({
    nodeEnvironment: parsed.NODE_ENV,
    provider: Object.freeze(provider),
  });
}
