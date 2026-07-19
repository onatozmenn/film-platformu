import { describe, expect, it } from "vitest";

import type { ProductionReadinessEvidence } from "./production-readiness";
import { createProductionReadinessReport } from "./production-readiness-report";

const evidence: ProductionReadinessEvidence = {
  advertisingApprovalReference: "approval:advertising",
  alertingReference: "runbook:alerting",
  backupRestoreReference: "rehearsal:restore",
  brandApprovalReference: "approval:brand",
  cspReviewReference: "evidence:csp-review",
  cronMonitoringReference: "dashboard:cron",
  databaseIsolationReference: "evidence:database-isolation",
  domainTlsReference: "evidence:domain-tls",
  edgeProtectionReference: "evidence:edge-protection",
  legalApprovalReference: "approval:legal",
  observabilityReference: "dashboard:observability",
  ownerAcceptanceReference: "approval:owner",
  rightsCatalogReference: "evidence:rights-catalog",
  rollbackRehearsalReference: "rehearsal:rollback",
  secretManagerReference: "evidence:secret-manager",
  stagingRehearsalReference: "rehearsal:staging",
  supportContactReference: "approval:support-contact",
  tmdbAttributionReference: "approval:tmdb-attribution",
};

const productionSource = {
  ADVERTISING_PROVIDER: "disabled",
  AUTH_EMAIL_FROM: "login@film.example",
  AUTH_EMAIL_PROVIDER: "smtp",
  AUTH_SECRET: "a".repeat(32),
  AUTH_SMTP_URL: "smtps://mailer:password@mail.example:465",
  CRON_SECRET: "c".repeat(32),
  DATABASE_URL: "postgresql://runtime:password@database.example/film",
  MUX_SIGNING_KEY_ID: "signing-key-id",
  MUX_SIGNING_PRIVATE_KEY: "private-key-material",
  MUX_TOKEN_ID: "management-token-id",
  MUX_TOKEN_SECRET: "management-token-secret",
  MUX_WEBHOOK_SECRET: "webhook-secret-value",
  NEXT_PUBLIC_SITE_NAME: "Approved Film Service",
  NEXTAUTH_URL: "https://film.example",
  NODE_ENV: "production",
  PRODUCTION_CSP_ENFORCED: "true",
  PRODUCTION_HSTS_ENABLED: "true",
  RELEASE_ID: "abcdef1234567890",
  SITE_ORIGIN: "https://film.example",
  SUPPORTED_TERRITORIES: "TR",
  TMDB_API_TOKEN: "t".repeat(32),
  TMDB_ENABLED: "true",
  VIDEO_PROVIDER: "mux",
} as const;

describe("production readiness report", () => {
  it("exposes the current accepted advertising gate without leaking configuration", () => {
    const report = createProductionReadinessReport(productionSource, evidence);

    expect(report).toEqual({
      configurationIssues: [],
      readinessIssues: ["ADVERTISING_DISABLED", "PUBLIC_CONTENT_INCOMPLETE"],
      ready: false,
    });
    expect(JSON.stringify(report)).not.toContain("password");
    expect(JSON.stringify(report)).not.toContain("private-key-material");
  });

  it("maps invalid configuration groups to stable coarse codes", () => {
    expect(
      createProductionReadinessReport(
        {
          ...productionSource,
          AUTH_EMAIL_PROVIDER: "fake",
          MUX_TOKEN_SECRET: "",
          PUBLISH_BATCH_LIMIT: "0",
        },
        evidence,
      ),
    ).toEqual({
      configurationIssues: [
        "SERVER_CONFIGURATION_INVALID",
        "IDENTITY_CONFIGURATION_INVALID",
        "INTERNAL_JOBS_CONFIGURATION_INVALID",
      ],
      readinessIssues: [],
      ready: false,
    });
  });
});
