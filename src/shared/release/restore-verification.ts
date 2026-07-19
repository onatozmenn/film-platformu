export type RestoreVerificationIssueCode =
  | "ACTIVE_ADMIN_MISSING"
  | "CATALOG_EMPTY"
  | "COMPLETED_DELETION_DATA_RESTORED"
  | "DUE_DELETION_REPLAY_PENDING"
  | "PENDING_DELETION_STATE_INVALID"
  | "PUBLICATION_HISTORY_INVALID";

export type RestoreVerificationSnapshot = Readonly<{
  activeAdminCount: number;
  catalogMovieCount: number;
  completedDeletionUsersRemaining: number;
  dueDeletionRequestCount: number;
  invalidPendingDeletionRequestCount: number;
  publicationHistoryInvalidCount: number;
}>;

export type RestoreVerificationDecision =
  | Readonly<{ ready: true }>
  | Readonly<{ issues: readonly RestoreVerificationIssueCode[]; ready: false }>;

export function evaluateRestoreVerification(
  snapshot: RestoreVerificationSnapshot,
): RestoreVerificationDecision {
  const issues: RestoreVerificationIssueCode[] = [];
  if (snapshot.catalogMovieCount < 1) issues.push("CATALOG_EMPTY");
  if (snapshot.activeAdminCount < 1) issues.push("ACTIVE_ADMIN_MISSING");
  if (snapshot.publicationHistoryInvalidCount > 0) issues.push("PUBLICATION_HISTORY_INVALID");
  if (snapshot.invalidPendingDeletionRequestCount > 0) {
    issues.push("PENDING_DELETION_STATE_INVALID");
  }
  if (snapshot.completedDeletionUsersRemaining > 0) {
    issues.push("COMPLETED_DELETION_DATA_RESTORED");
  }
  if (snapshot.dueDeletionRequestCount > 0) issues.push("DUE_DELETION_REPLAY_PENDING");
  return issues.length === 0 ? { ready: true } : { issues, ready: false };
}

export function assertIsolatedRestoreDatabaseUrl(value: string | undefined): string {
  if (value === undefined || value.trim().length === 0) {
    throw new Error("RESTORE_DATABASE_URL is required");
  }
  const url = new URL(value);
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (
    (url.protocol !== "postgresql:" && url.protocol !== "postgres:") ||
    databaseName.length === 0 ||
    databaseName.includes("/") ||
    !databaseName.endsWith("_restore")
  ) {
    throw new Error("RESTORE_DATABASE_URL must target a database ending in _restore");
  }
  return value;
}
