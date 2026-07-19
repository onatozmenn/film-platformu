export type AccountDeletionWriteResult =
  "already-requested" | "final-admin" | "not-found" | "requested";

export type RetentionRunResult = Readonly<{
  examined: number;
  failed: number;
  purged: number;
  skipped: number;
}>;

export interface AccountLifecycleRepositoryPort {
  purgeDueAccounts(now: Date, limit: number): Promise<RetentionRunResult>;
  requestDeletion(
    userId: string,
    requestedAt: Date,
    purgeAfter: Date,
  ): Promise<AccountDeletionWriteResult>;
}
