import { isPublicHttpsOrigin } from "@/shared/config/public-https-origin";

export type ProductionReadinessIssueCode =
  | "ADVERTISING_APPROVAL_MISSING"
  | "ADVERTISING_DISABLED"
  | "ALERTING_MISSING"
  | "AUTH_CALLBACK_ORIGIN_MISMATCH"
  | "BACKUP_RESTORE_MISSING"
  | "BRAND_APPROVAL_MISSING"
  | "CSP_NOT_ENFORCED"
  | "CSP_REVIEW_MISSING"
  | "CRON_MONITORING_MISSING"
  | "DATABASE_ISOLATION_MISSING"
  | "DOMAIN_TLS_MISSING"
  | "EDGE_PROTECTION_MISSING"
  | "EMAIL_PROVIDER_NOT_SMTP"
  | "HSTS_DISABLED"
  | "INTERNAL_JOBS_DISABLED"
  | "LEGAL_APPROVAL_MISSING"
  | "LOCAL_TERRITORY_FALLBACK_PRESENT"
  | "METADATA_PROVIDER_DISABLED"
  | "NOT_PRODUCTION"
  | "OBSERVABILITY_MISSING"
  | "OWNER_ACCEPTANCE_MISSING"
  | "PUBLIC_CONTENT_INCOMPLETE"
  | "RELEASE_IDENTIFIER_MISSING"
  | "RIGHTS_CATALOG_MISSING"
  | "ROLLBACK_REHEARSAL_MISSING"
  | "SECRET_MANAGER_MISSING"
  | "SITE_NAME_TEMPORARY"
  | "SITE_ORIGIN_NOT_PUBLIC_HTTPS"
  | "STAGING_REHEARSAL_MISSING"
  | "SUPPORT_CONTACT_MISSING"
  | "TMDB_ATTRIBUTION_MISSING"
  | "VIDEO_PROVIDER_NOT_MUX";

export type ProductionReadinessEvidence = Readonly<{
  advertisingApprovalReference: string | null;
  alertingReference: string | null;
  backupRestoreReference: string | null;
  brandApprovalReference: string | null;
  cspReviewReference: string | null;
  cronMonitoringReference: string | null;
  databaseIsolationReference: string | null;
  domainTlsReference: string | null;
  edgeProtectionReference: string | null;
  legalApprovalReference: string | null;
  observabilityReference: string | null;
  ownerAcceptanceReference: string | null;
  rightsCatalogReference: string | null;
  rollbackRehearsalReference: string | null;
  secretManagerReference: string | null;
  stagingRehearsalReference: string | null;
  supportContactReference: string | null;
  tmdbAttributionReference: string | null;
}>;

export type ProductionRuntimeFacts = Readonly<{
  advertisingProvider: "disabled" | "production";
  authCallbackOrigin: string;
  cspEnforced: boolean;
  emailProvider: "disabled" | "smtp";
  hstsEnabled: boolean;
  internalJobsEnabled: boolean;
  localDefaultTerritory: string | null;
  metadataProvider: "disabled" | "tmdb";
  nodeEnvironment: "development" | "production" | "test";
  publicContentComplete: boolean;
  releaseIdentifier: string;
  siteName: string;
  siteOrigin: string;
  videoProvider: "fake" | "mux";
}>;

export type ProductionReadinessInput = Readonly<{
  evidence: ProductionReadinessEvidence;
  runtime: ProductionRuntimeFacts;
}>;

export type ProductionReadinessDecision =
  | Readonly<{ ready: true }>
  | Readonly<{ issues: readonly ProductionReadinessIssueCode[]; ready: false }>;

function hasEvidence(value: string | null): boolean {
  return value !== null && value.trim().length >= 3;
}

export function evaluateProductionReadiness(
  input: ProductionReadinessInput,
): ProductionReadinessDecision {
  const issues: ProductionReadinessIssueCode[] = [];
  const { evidence, runtime } = input;
  const publicSiteOrigin = isPublicHttpsOrigin(runtime.siteOrigin);

  if (runtime.nodeEnvironment !== "production") issues.push("NOT_PRODUCTION");
  if (!publicSiteOrigin) issues.push("SITE_ORIGIN_NOT_PUBLIC_HTTPS");
  if (
    publicSiteOrigin &&
    (!isPublicHttpsOrigin(runtime.authCallbackOrigin) ||
      new URL(runtime.authCallbackOrigin).origin !== new URL(runtime.siteOrigin).origin)
  ) {
    issues.push("AUTH_CALLBACK_ORIGIN_MISMATCH");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{6,63}$/u.test(runtime.releaseIdentifier)) {
    issues.push("RELEASE_IDENTIFIER_MISSING");
  }
  if (runtime.siteName.trim().toLocaleLowerCase("en-US") === "film platform") {
    issues.push("SITE_NAME_TEMPORARY");
  }
  if (runtime.videoProvider !== "mux") issues.push("VIDEO_PROVIDER_NOT_MUX");
  if (runtime.emailProvider !== "smtp") issues.push("EMAIL_PROVIDER_NOT_SMTP");
  if (runtime.metadataProvider !== "tmdb") issues.push("METADATA_PROVIDER_DISABLED");
  if (runtime.advertisingProvider !== "production") issues.push("ADVERTISING_DISABLED");
  if (!runtime.publicContentComplete) issues.push("PUBLIC_CONTENT_INCOMPLETE");
  if (!runtime.internalJobsEnabled) issues.push("INTERNAL_JOBS_DISABLED");
  if (runtime.localDefaultTerritory !== null) issues.push("LOCAL_TERRITORY_FALLBACK_PRESENT");
  if (!runtime.cspEnforced) issues.push("CSP_NOT_ENFORCED");
  if (!runtime.hstsEnabled) issues.push("HSTS_DISABLED");

  const evidenceChecks = [
    [evidence.brandApprovalReference, "BRAND_APPROVAL_MISSING"],
    [evidence.cspReviewReference, "CSP_REVIEW_MISSING"],
    [evidence.domainTlsReference, "DOMAIN_TLS_MISSING"],
    [evidence.databaseIsolationReference, "DATABASE_ISOLATION_MISSING"],
    [evidence.edgeProtectionReference, "EDGE_PROTECTION_MISSING"],
    [evidence.rightsCatalogReference, "RIGHTS_CATALOG_MISSING"],
    [evidence.legalApprovalReference, "LEGAL_APPROVAL_MISSING"],
    [evidence.supportContactReference, "SUPPORT_CONTACT_MISSING"],
    [evidence.tmdbAttributionReference, "TMDB_ATTRIBUTION_MISSING"],
    [evidence.advertisingApprovalReference, "ADVERTISING_APPROVAL_MISSING"],
    [evidence.cronMonitoringReference, "CRON_MONITORING_MISSING"],
    [evidence.observabilityReference, "OBSERVABILITY_MISSING"],
    [evidence.alertingReference, "ALERTING_MISSING"],
    [evidence.secretManagerReference, "SECRET_MANAGER_MISSING"],
    [evidence.backupRestoreReference, "BACKUP_RESTORE_MISSING"],
    [evidence.stagingRehearsalReference, "STAGING_REHEARSAL_MISSING"],
    [evidence.rollbackRehearsalReference, "ROLLBACK_REHEARSAL_MISSING"],
    [evidence.ownerAcceptanceReference, "OWNER_ACCEPTANCE_MISSING"],
  ] as const satisfies readonly (readonly [string | null, ProductionReadinessIssueCode])[];

  for (const [reference, issue] of evidenceChecks) {
    if (!hasEvidence(reference)) issues.push(issue);
  }

  return issues.length === 0 ? { ready: true } : { issues, ready: false };
}
