export type ProductionCatalogAuditIssueCode =
  "ACTIVE_RIGHT_EVIDENCE_MISSING" | "CATALOG_EMPTY" | "NO_CURRENTLY_PLAYABLE_TITLE";

export type ProductionCatalogAuditSnapshot = Readonly<{
  activeRightsWithoutEvidenceCount: number;
  currentlyPlayableMovieCount: number;
  publishedMovieCount: number;
}>;

export type ProductionCatalogAuditDecision =
  | Readonly<{ ready: true }>
  | Readonly<{ issues: readonly ProductionCatalogAuditIssueCode[]; ready: false }>;

export function evaluateProductionCatalogAudit(
  snapshot: ProductionCatalogAuditSnapshot,
): ProductionCatalogAuditDecision {
  const issues: ProductionCatalogAuditIssueCode[] = [];
  if (snapshot.publishedMovieCount < 1) issues.push("CATALOG_EMPTY");
  if (snapshot.currentlyPlayableMovieCount < 1) issues.push("NO_CURRENTLY_PLAYABLE_TITLE");
  if (snapshot.activeRightsWithoutEvidenceCount > 0) {
    issues.push("ACTIVE_RIGHT_EVIDENCE_MISSING");
  }
  return issues.length === 0 ? { ready: true } : { issues, ready: false };
}
