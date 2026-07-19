import { accountDeletionPurgeAfter } from "../domain/account-deletion-policy";
import type { AccountLifecycleRepositoryPort, RetentionRunResult } from "./account-lifecycle-port";

export type AccountDeletionResult =
  | Readonly<{ kind: "final-admin" }>
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "not-found" }>
  | Readonly<{ kind: "success" }>;

export function createAccountLifecycleService(
  repository: AccountLifecycleRepositoryPort,
  clock: () => Date,
) {
  return {
    async purgeDueAccounts(limit: number): Promise<RetentionRunResult> {
      return repository.purgeDueAccounts(clock(), limit);
    },

    async requestDeletion(
      command: Readonly<{
        actorUserId: string;
        ownerUserId: string;
      }>,
    ): Promise<AccountDeletionResult> {
      if (command.actorUserId !== command.ownerUserId) {
        return { kind: "forbidden" };
      }
      const requestedAt = clock();
      const result = await repository.requestDeletion(
        command.ownerUserId,
        requestedAt,
        accountDeletionPurgeAfter(requestedAt),
      );
      switch (result) {
        case "already-requested":
        case "requested":
          return { kind: "success" };
        case "final-admin":
          return { kind: "final-admin" };
        case "not-found":
          return { kind: "not-found" };
      }
    },
  };
}
