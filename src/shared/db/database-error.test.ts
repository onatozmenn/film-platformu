import { describe, expect, it } from "vitest";

import { hasDatabaseErrorCode } from "./database-error";

describe("database error classification", () => {
  it("recognizes Prisma and nested driver-adapter codes", () => {
    expect(hasDatabaseErrorCode({ code: "P2034" }, "P2034", "40001")).toBe(true);
    expect(
      hasDatabaseErrorCode(
        { cause: { kind: "TransactionWriteConflict", originalCode: "40001" } },
        "P2034",
        "40001",
      ),
    ).toBe(true);
  });

  it("rejects malformed, unrelated, and cyclic causes", () => {
    expect(hasDatabaseErrorCode(null, "P2034")).toBe(false);
    expect(hasDatabaseErrorCode({ code: 40001 }, "40001")).toBe(false);
    expect(hasDatabaseErrorCode({ cause: { originalCode: "23505" } }, "40001")).toBe(false);

    const cyclic: Record<string, unknown> = {};
    cyclic.cause = cyclic;
    expect(hasDatabaseErrorCode(cyclic, "P2034")).toBe(false);
  });
});
