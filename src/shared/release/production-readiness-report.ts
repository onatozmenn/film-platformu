import { parseAdvertisingEnvironment } from "@/modules/advertising/infrastructure/advertising-environment";
import {
  approvedPublicContent,
  isApprovedPublicContentComplete,
} from "@/modules/compliance/approved-public-content";
import { parseIdentityEnvironment } from "@/modules/identity/infrastructure/identity-environment";
import { parseInternalJobsEnvironment } from "@/shared/config/internal-jobs-environment";
import { parsePublicEnvironment } from "@/shared/config/public-environment";
import { parseSecurityHeadersEnvironment } from "@/shared/config/security-headers-environment";
import { parseServerEnvironment } from "@/shared/config/server-environment-schema";

import {
  evaluateProductionReadiness,
  type ProductionReadinessEvidence,
  type ProductionReadinessIssueCode,
} from "./production-readiness";

export type ProductionConfigurationIssueCode =
  | "ADVERTISING_CONFIGURATION_INVALID"
  | "EVIDENCE_INPUT_INVALID"
  | "IDENTITY_CONFIGURATION_INVALID"
  | "INTERNAL_JOBS_CONFIGURATION_INVALID"
  | "PUBLIC_CONFIGURATION_INVALID"
  | "SECURITY_HEADERS_CONFIGURATION_INVALID"
  | "SERVER_CONFIGURATION_INVALID";

export type ProductionReadinessReport = Readonly<{
  configurationIssues: readonly ProductionConfigurationIssueCode[];
  readinessIssues: readonly ProductionReadinessIssueCode[];
  ready: boolean;
}>;

export type ProductionEnvironmentSource = Readonly<Record<string, string | undefined>>;

function parseConfiguration<T>(
  issues: ProductionConfigurationIssueCode[],
  issue: ProductionConfigurationIssueCode,
  operation: () => T,
): T | null {
  try {
    return operation();
  } catch {
    issues.push(issue);
    return null;
  }
}

export function invalidProductionReadinessReport(
  issue: ProductionConfigurationIssueCode,
): ProductionReadinessReport {
  return { configurationIssues: [issue], readinessIssues: [], ready: false };
}

export function createProductionReadinessReport(
  source: ProductionEnvironmentSource,
  evidence: ProductionReadinessEvidence,
): ProductionReadinessReport {
  const configurationIssues: ProductionConfigurationIssueCode[] = [];
  const server = parseConfiguration(configurationIssues, "SERVER_CONFIGURATION_INVALID", () =>
    parseServerEnvironment({
      DATABASE_URL: source.DATABASE_URL,
      LOCAL_DEFAULT_TERRITORY: source.LOCAL_DEFAULT_TERRITORY,
      LOG_LEVEL: source.LOG_LEVEL,
      MUX_SIGNING_KEY_ID: source.MUX_SIGNING_KEY_ID,
      MUX_SIGNING_PRIVATE_KEY: source.MUX_SIGNING_PRIVATE_KEY,
      MUX_TOKEN_ID: source.MUX_TOKEN_ID,
      MUX_TOKEN_SECRET: source.MUX_TOKEN_SECRET,
      MUX_WEBHOOK_SECRET: source.MUX_WEBHOOK_SECRET,
      NODE_ENV: source.NODE_ENV,
      RELEASE_ID: source.RELEASE_ID,
      SITE_ORIGIN: source.SITE_ORIGIN,
      SUPPORTED_TERRITORIES: source.SUPPORTED_TERRITORIES,
      TMDB_API_TOKEN: source.TMDB_API_TOKEN,
      TMDB_ENABLED: source.TMDB_ENABLED,
      TRUST_INCOMING_REQUEST_ID: source.TRUST_INCOMING_REQUEST_ID,
      VIDEO_PROVIDER: source.VIDEO_PROVIDER,
    }),
  );
  const identity = parseConfiguration(configurationIssues, "IDENTITY_CONFIGURATION_INVALID", () =>
    parseIdentityEnvironment({
      AUTH_EMAIL_FROM: source.AUTH_EMAIL_FROM,
      AUTH_EMAIL_PROVIDER: source.AUTH_EMAIL_PROVIDER,
      AUTH_SECRET: source.AUTH_SECRET,
      AUTH_SMTP_URL: source.AUTH_SMTP_URL,
      NODE_ENV: source.NODE_ENV,
    }),
  );
  const advertising = parseConfiguration(
    configurationIssues,
    "ADVERTISING_CONFIGURATION_INVALID",
    () =>
      parseAdvertisingEnvironment({
        ADVERTISING_PROVIDER: source.ADVERTISING_PROVIDER,
        ADVERTISING_TEST_SCENARIO: source.ADVERTISING_TEST_SCENARIO,
        NODE_ENV: source.NODE_ENV,
      }),
  );
  const jobs = parseConfiguration(configurationIssues, "INTERNAL_JOBS_CONFIGURATION_INVALID", () =>
    parseInternalJobsEnvironment({
      CRON_SECRET: source.CRON_SECRET,
      NODE_ENV: source.NODE_ENV,
      PUBLISH_BATCH_LIMIT: source.PUBLISH_BATCH_LIMIT,
      RETENTION_BATCH_LIMIT: source.RETENTION_BATCH_LIMIT,
    }),
  );
  const publicEnvironment = parseConfiguration(
    configurationIssues,
    "PUBLIC_CONFIGURATION_INVALID",
    () => parsePublicEnvironment({ NEXT_PUBLIC_SITE_NAME: source.NEXT_PUBLIC_SITE_NAME }),
  );
  const securityHeaders = parseConfiguration(
    configurationIssues,
    "SECURITY_HEADERS_CONFIGURATION_INVALID",
    () =>
      parseSecurityHeadersEnvironment({
        NODE_ENV: source.NODE_ENV,
        PRODUCTION_CSP_ENFORCED: source.PRODUCTION_CSP_ENFORCED,
        PRODUCTION_HSTS_ENABLED: source.PRODUCTION_HSTS_ENABLED,
        SITE_ORIGIN: source.SITE_ORIGIN,
      }),
  );

  if (
    server === null ||
    identity === null ||
    advertising === null ||
    jobs === null ||
    publicEnvironment === null ||
    securityHeaders === null
  ) {
    return { configurationIssues, readinessIssues: [], ready: false };
  }

  const advertisingKinds = { disabled: "disabled", fake: "disabled" } as const;
  const decision = evaluateProductionReadiness({
    evidence,
    runtime: {
      advertisingProvider: advertisingKinds[advertising.provider.kind],
      authCallbackOrigin: source.NEXTAUTH_URL ?? "",
      cspEnforced: securityHeaders.cspEnforced,
      emailProvider: identity.provider.kind === "smtp" ? "smtp" : "disabled",
      hstsEnabled: securityHeaders.hstsEnabled,
      internalJobsEnabled: jobs.kind === "enabled",
      localDefaultTerritory: server.playback.localDefaultTerritory,
      metadataProvider: server.metadataProvider.kind,
      nodeEnvironment: server.nodeEnvironment,
      publicContentComplete: isApprovedPublicContentComplete(approvedPublicContent),
      releaseIdentifier: source.RELEASE_ID ?? "",
      siteName: publicEnvironment.siteName,
      siteOrigin: server.siteOrigin,
      videoProvider: server.playback.videoProvider.kind,
    },
  });

  return {
    configurationIssues,
    readinessIssues: decision.ready ? [] : decision.issues,
    ready: decision.ready,
  };
}
