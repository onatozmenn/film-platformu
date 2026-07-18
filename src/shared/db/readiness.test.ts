import { describe, expect, it } from "vitest";

import { checkDatabaseReadiness } from "./readiness";

describe("checkDatabaseReadiness", () => {
  it("reports a successful bounded probe", async () => {
    await expect(checkDatabaseReadiness(async () => 1)).resolves.toEqual({ ready: true });
  });

  it("returns only a coarse failure reason", async () => {
    await expect(
      checkDatabaseReadiness(async () => {
        throw new Error("postgresql://secret-connection-details");
      }),
    ).resolves.toEqual({ ready: false, reason: "query-failed" });
  });

  it("fails a probe that exceeds its deadline", async () => {
    await expect(checkDatabaseReadiness(() => new Promise(() => undefined), 5)).resolves.toEqual({
      ready: false,
      reason: "timeout",
    });
  });
});
