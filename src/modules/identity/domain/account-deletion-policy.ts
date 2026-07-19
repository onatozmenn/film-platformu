export const accountDeletionWindowMilliseconds = 30 * 24 * 60 * 60 * 1_000;

export function accountDeletionPurgeAfter(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + accountDeletionWindowMilliseconds);
}
