import { describe, expect, it, vi } from "vitest";

import type { AccountLifecycleRepositoryPort } from "./account-lifecycle-port";
import { createAccountLifecycleService } from "./create-account-lifecycle-service";

const now = new Date("2026-07-19T12:00:00.000Z");

function repository(result: "already-requested" | "final-admin" | "not-found" | "requested") {
  return {
    purgeDueAccounts: vi.fn(async () => ({ examined: 1, failed: 0, purged: 1, skipped: 0 })),
    requestDeletion: vi.fn(async () => result),
  } satisfies AccountLifecycleRepositoryPort;
}

describe("account lifecycle service", () => {
  it("denies cross-user deletion before persistence", async () => {
    const port = repository("requested");

    await expect(
      createAccountLifecycleService(port, () => now).requestDeletion({
        actorUserId: "user-a",
        ownerUserId: "user-b",
      }),
    ).resolves.toEqual({ kind: "forbidden" });
    expect(port.requestDeletion).not.toHaveBeenCalled();
  });

  it.each([
    ["requested", "success"],
    ["already-requested", "success"],
    ["final-admin", "final-admin"],
    ["not-found", "not-found"],
  ] as const)("maps repository deletion result %s", async (result, kind) => {
    const port = repository(result);

    await expect(
      createAccountLifecycleService(port, () => now).requestDeletion({
        actorUserId: "user-a",
        ownerUserId: "user-a",
      }),
    ).resolves.toEqual({ kind });
    expect(port.requestDeletion).toHaveBeenCalledWith(
      "user-a",
      now,
      new Date("2026-08-18T12:00:00.000Z"),
    );
  });

  it("uses only the server clock and configured bounded retention limit", async () => {
    const port = repository("requested");

    await expect(
      createAccountLifecycleService(port, () => now).purgeDueAccounts(25),
    ).resolves.toEqual({ examined: 1, failed: 0, purged: 1, skipped: 0 });
    expect(port.purgeDueAccounts).toHaveBeenCalledWith(now, 25);
  });
});
