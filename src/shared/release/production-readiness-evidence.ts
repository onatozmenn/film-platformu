import { z } from "zod";

import type { ProductionReadinessEvidence } from "./production-readiness";

const referenceSchema = z
  .string()
  .trim()
  .min(3)
  .max(256)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/#-]*$/u);
const optionalReferenceSchema = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  referenceSchema.nullable(),
);
const schema = z
  .object({
    advertisingApprovalReference: optionalReferenceSchema,
    alertingReference: optionalReferenceSchema,
    backupRestoreReference: optionalReferenceSchema,
    brandApprovalReference: optionalReferenceSchema,
    cspReviewReference: optionalReferenceSchema,
    cronMonitoringReference: optionalReferenceSchema,
    databaseIsolationReference: optionalReferenceSchema,
    domainTlsReference: optionalReferenceSchema,
    edgeProtectionReference: optionalReferenceSchema,
    legalApprovalReference: optionalReferenceSchema,
    observabilityReference: optionalReferenceSchema,
    ownerAcceptanceReference: optionalReferenceSchema,
    rightsCatalogReference: optionalReferenceSchema,
    rollbackRehearsalReference: optionalReferenceSchema,
    secretManagerReference: optionalReferenceSchema,
    stagingRehearsalReference: optionalReferenceSchema,
    supportContactReference: optionalReferenceSchema,
    tmdbAttributionReference: optionalReferenceSchema,
  })
  .strict();

export function parseProductionReadinessEvidence(value: unknown): ProductionReadinessEvidence {
  return Object.freeze(schema.parse(value));
}
