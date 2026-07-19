import { describe, expect, it } from "vitest";

import {
  assertIsolatedRestoreDatabaseUrl,
  evaluateRestoreVerification,
  type RestoreVerificationIssueCode,
  type RestoreVerificationSnapshot,
} from "./restore-verification";

const validSnapshot: RestoreVerificationSnapshot = {
  activeAdminCount: 1,
  catalogMovieCount: 14,
  completedDeletionUsersRemaining: 0,
  dueDeletionRequestCount: 0,
  invalidPendingDeletionRequestCount: 0,
  publicationHistoryInvalidCount: 0,
};

describe("restore verification policy", () => {
  it("accepts a restored database only after aggregate invariants pass", () => {
    expect(evaluateRestoreVerification(validSnapshot)).toEqual({ ready: true });
  });

  it.each([
    ["CATALOG_EMPTY", { catalogMovieCount: 0 }],
    ["ACTIVE_ADMIN_MISSING", { activeAdminCount: 0 }],
    ["PUBLICATION_HISTORY_INVALID", { publicationHistoryInvalidCount: 1 }],
    ["PENDING_DELETION_STATE_INVALID", { invalidPendingDeletionRequestCount: 1 }],
    ["COMPLETED_DELETION_DATA_RESTORED", { completedDeletionUsersRemaining: 1 }],
    ["DUE_DELETION_REPLAY_PENDING", { dueDeletionRequestCount: 1 }],
  ] as const satisfies readonly (readonly [
    RestoreVerificationIssueCode,
    Partial<RestoreVerificationSnapshot>,
  ])[])("returns %s for a failed restore invariant", (issue, override) => {
    expect(evaluateRestoreVerification({ ...validSnapshot, ...override })).toEqual({
      issues: [issue],
      ready: false,
    });
  });

  it("accepts only an explicitly isolated PostgreSQL restore database", () => {
    const restoreUrl = "postgresql://restore:password@database.example/film_platform_restore";
    expect(assertIsolatedRestoreDatabaseUrl(restoreUrl)).toBe(restoreUrl);
    expect(() => assertIsolatedRestoreDatabaseUrl(undefined)).toThrow();
    expect(() =>
      assertIsolatedRestoreDatabaseUrl(
        "postgresql://runtime:password@database.example/film_platform",
      ),
    ).toThrow("ending in _restore");
    expect(() => assertIsolatedRestoreDatabaseUrl("https://database.example/film_restore")).toThrow(
      "ending in _restore",
    );
  });
});
