import { describe, expect, it } from "vitest";

import { accountDeletionPurgeAfter } from "./account-deletion-policy";

describe("account deletion policy", () => {
  it("sets the exact 30-day purge boundary", () => {
    expect(accountDeletionPurgeAfter(new Date("2026-07-19T12:00:00.000Z"))).toEqual(
      new Date("2026-08-18T12:00:00.000Z"),
    );
  });
});
