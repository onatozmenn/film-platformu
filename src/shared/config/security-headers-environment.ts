import { z } from "zod";

import { isPublicHttpsOrigin } from "./public-https-origin";

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PRODUCTION_CSP_ENFORCED: z.enum(["true", "false"]).default("false"),
    PRODUCTION_HSTS_ENABLED: z.enum(["true", "false"]).default("false"),
    RELEASE_ID: z
      .string()
      .trim()
      .min(7)
      .max(64)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u)
      .default("local-development"),
    SITE_ORIGIN: z.url().default("http://localhost:3000"),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.PRODUCTION_CSP_ENFORCED === "true" && value.NODE_ENV !== "production") {
      context.addIssue({
        code: "custom",
        message: "PRODUCTION_CSP_ENFORCED is allowed only in production",
        path: ["PRODUCTION_CSP_ENFORCED"],
      });
    }
    if (value.PRODUCTION_HSTS_ENABLED === "true" && value.NODE_ENV !== "production") {
      context.addIssue({
        code: "custom",
        message: "PRODUCTION_HSTS_ENABLED is allowed only in production",
        path: ["PRODUCTION_HSTS_ENABLED"],
      });
    }
    if (value.PRODUCTION_CSP_ENFORCED === "true" && !isPublicHttpsOrigin(value.SITE_ORIGIN)) {
      context.addIssue({
        code: "custom",
        message: "PRODUCTION_CSP_ENFORCED requires a public HTTPS SITE_ORIGIN",
        path: ["SITE_ORIGIN"],
      });
    }
    if (value.PRODUCTION_HSTS_ENABLED === "true" && !isPublicHttpsOrigin(value.SITE_ORIGIN)) {
      context.addIssue({
        code: "custom",
        message: "PRODUCTION_HSTS_ENABLED requires a public HTTPS SITE_ORIGIN",
        path: ["SITE_ORIGIN"],
      });
    }
  });

export type SecurityHeadersEnvironment = Readonly<{
  cspEnforced: boolean;
  hstsEnabled: boolean;
  releaseId: string;
}>;

export function parseSecurityHeadersEnvironment(source: {
  NODE_ENV?: string | undefined;
  PRODUCTION_CSP_ENFORCED?: string | undefined;
  PRODUCTION_HSTS_ENABLED?: string | undefined;
  RELEASE_ID?: string | undefined;
  SITE_ORIGIN?: string | undefined;
}): SecurityHeadersEnvironment {
  const parsed = schema.parse(source);
  return Object.freeze({
    cspEnforced: parsed.NODE_ENV === "production" && parsed.PRODUCTION_CSP_ENFORCED === "true",
    hstsEnabled: parsed.NODE_ENV === "production" && parsed.PRODUCTION_HSTS_ENABLED === "true",
    releaseId: parsed.RELEASE_ID,
  });
}
