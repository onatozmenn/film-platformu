import { describe, expect, it } from "vitest";

import {
  evaluateProductionReadiness,
  type ProductionReadinessEvidence,
  type ProductionReadinessInput,
  type ProductionReadinessIssueCode,
  type ProductionRuntimeFacts,
} from "./production-readiness";

const validRuntime: ProductionRuntimeFacts = {
  advertisingProvider: "production",
  authCallbackOrigin: "https://film.example",
  cspEnforced: true,
  emailProvider: "smtp",
  hstsEnabled: true,
  internalJobsEnabled: true,
  localDefaultTerritory: null,
  metadataProvider: "tmdb",
  nodeEnvironment: "production",
  publicContentComplete: true,
  releaseIdentifier: "abcdef1234567890",
  siteName: "Approved Film Service",
  siteOrigin: "https://film.example",
  videoProvider: "mux",
};

const validEvidence: ProductionReadinessEvidence = {
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

function input(
  runtime: Partial<ProductionRuntimeFacts> = {},
  evidence: Partial<ProductionReadinessEvidence> = {},
): ProductionReadinessInput {
  return {
    evidence: { ...validEvidence, ...evidence },
    runtime: { ...validRuntime, ...runtime },
  };
}

describe("production readiness policy", () => {
  it("accepts only a production-safe runtime with complete owner evidence", () => {
    expect(evaluateProductionReadiness(input())).toEqual({ ready: true });
  });

  it.each([
    ["NOT_PRODUCTION", input({ nodeEnvironment: "test" })],
    ["SITE_ORIGIN_NOT_PUBLIC_HTTPS", input({ siteOrigin: "http://localhost:3000" })],
    ["SITE_ORIGIN_NOT_PUBLIC_HTTPS", input({ siteOrigin: "not-a-url" })],
    ["SITE_ORIGIN_NOT_PUBLIC_HTTPS", input({ siteOrigin: "https://film.example/path" })],
    ["AUTH_CALLBACK_ORIGIN_MISMATCH", input({ authCallbackOrigin: "https://auth.film.example" })],
    ["RELEASE_IDENTIFIER_MISSING", input({ releaseIdentifier: "local" })],
    ["SITE_NAME_TEMPORARY", input({ siteName: " Film Platform " })],
    ["VIDEO_PROVIDER_NOT_MUX", input({ videoProvider: "fake" })],
    ["EMAIL_PROVIDER_NOT_SMTP", input({ emailProvider: "disabled" })],
    ["METADATA_PROVIDER_DISABLED", input({ metadataProvider: "disabled" })],
    ["ADVERTISING_DISABLED", input({ advertisingProvider: "disabled" })],
    ["PUBLIC_CONTENT_INCOMPLETE", input({ publicContentComplete: false })],
    ["INTERNAL_JOBS_DISABLED", input({ internalJobsEnabled: false })],
    ["LOCAL_TERRITORY_FALLBACK_PRESENT", input({ localDefaultTerritory: "TR" })],
    ["CSP_NOT_ENFORCED", input({ cspEnforced: false })],
    ["HSTS_DISABLED", input({ hstsEnabled: false })],
    ["BRAND_APPROVAL_MISSING", input({}, { brandApprovalReference: "" })],
    ["CSP_REVIEW_MISSING", input({}, { cspReviewReference: null })],
    ["DOMAIN_TLS_MISSING", input({}, { domainTlsReference: null })],
    ["DATABASE_ISOLATION_MISSING", input({}, { databaseIsolationReference: "x" })],
    ["EDGE_PROTECTION_MISSING", input({}, { edgeProtectionReference: null })],
    ["RIGHTS_CATALOG_MISSING", input({}, { rightsCatalogReference: null })],
    ["LEGAL_APPROVAL_MISSING", input({}, { legalApprovalReference: null })],
    ["SUPPORT_CONTACT_MISSING", input({}, { supportContactReference: null })],
    ["TMDB_ATTRIBUTION_MISSING", input({}, { tmdbAttributionReference: null })],
    ["ADVERTISING_APPROVAL_MISSING", input({}, { advertisingApprovalReference: null })],
    ["CRON_MONITORING_MISSING", input({}, { cronMonitoringReference: null })],
    ["OBSERVABILITY_MISSING", input({}, { observabilityReference: null })],
    ["ALERTING_MISSING", input({}, { alertingReference: null })],
    ["SECRET_MANAGER_MISSING", input({}, { secretManagerReference: null })],
    ["BACKUP_RESTORE_MISSING", input({}, { backupRestoreReference: null })],
    ["STAGING_REHEARSAL_MISSING", input({}, { stagingRehearsalReference: null })],
    ["ROLLBACK_REHEARSAL_MISSING", input({}, { rollbackRehearsalReference: null })],
    ["OWNER_ACCEPTANCE_MISSING", input({}, { ownerAcceptanceReference: null })],
  ] as const satisfies readonly (readonly [
    ProductionReadinessIssueCode,
    ProductionReadinessInput,
  ])[])("returns %s for an unsafe or unverified boundary", (issue, candidate) => {
    expect(evaluateProductionReadiness(candidate)).toEqual({ issues: [issue], ready: false });
  });
});
