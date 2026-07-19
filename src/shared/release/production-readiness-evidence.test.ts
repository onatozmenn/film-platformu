import { describe, expect, it } from "vitest";

import { parseProductionReadinessEvidence } from "./production-readiness-evidence";

const emptyEvidence = {
  advertisingApprovalReference: null,
  alertingReference: null,
  backupRestoreReference: null,
  brandApprovalReference: null,
  cspReviewReference: null,
  cronMonitoringReference: null,
  databaseIsolationReference: null,
  domainTlsReference: null,
  edgeProtectionReference: null,
  legalApprovalReference: null,
  observabilityReference: null,
  ownerAcceptanceReference: null,
  rightsCatalogReference: null,
  rollbackRehearsalReference: null,
  secretManagerReference: null,
  stagingRehearsalReference: null,
  supportContactReference: null,
  tmdbAttributionReference: null,
} as const;

describe("production readiness evidence", () => {
  it("accepts null placeholders and normalizes non-secret references", () => {
    expect(parseProductionReadinessEvidence(emptyEvidence)).toEqual(emptyEvidence);
    expect(
      parseProductionReadinessEvidence({
        ...emptyEvidence,
        brandApprovalReference: "  approval:BRAND-42  ",
        legalApprovalReference: "https://evidence.example/legal#approved",
      }),
    ).toMatchObject({
      brandApprovalReference: "approval:BRAND-42",
      legalApprovalReference: "https://evidence.example/legal#approved",
    });
  });

  it.each([
    { ...emptyEvidence, legalApprovalReference: "approval with copied legal text" },
    { ...emptyEvidence, rightsCatalogReference: "https://evidence.example/rights?token=secret" },
    { ...emptyEvidence, unexpected: "value" },
  ])("rejects unsafe or unknown evidence data %#", (value) => {
    expect(() => parseProductionReadinessEvidence(value)).toThrow();
  });
});
