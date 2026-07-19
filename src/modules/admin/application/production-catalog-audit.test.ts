import { describe, expect, it } from "vitest";

import {
  evaluateProductionCatalogAudit,
  type ProductionCatalogAuditIssueCode,
  type ProductionCatalogAuditSnapshot,
} from "./production-catalog-audit";

const validSnapshot: ProductionCatalogAuditSnapshot = {
  activeRightsWithoutEvidenceCount: 0,
  currentlyPlayableMovieCount: 1,
  publishedMovieCount: 10,
};

describe("production catalog audit policy", () => {
  it("accepts a nonempty catalog with a playable title and evidence-linked active rights", () => {
    expect(evaluateProductionCatalogAudit(validSnapshot)).toEqual({ ready: true });
  });

  it.each([
    ["CATALOG_EMPTY", { publishedMovieCount: 0 }],
    ["NO_CURRENTLY_PLAYABLE_TITLE", { currentlyPlayableMovieCount: 0 }],
    ["ACTIVE_RIGHT_EVIDENCE_MISSING", { activeRightsWithoutEvidenceCount: 1 }],
  ] as const satisfies readonly (readonly [
    ProductionCatalogAuditIssueCode,
    Partial<ProductionCatalogAuditSnapshot>,
  ])[])("returns %s for an unsafe launch catalog", (issue, override) => {
    expect(evaluateProductionCatalogAudit({ ...validSnapshot, ...override })).toEqual({
      issues: [issue],
      ready: false,
    });
  });
});
