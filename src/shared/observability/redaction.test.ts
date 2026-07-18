import { describe, expect, it } from "vitest";

import { redactLogContext } from "./redaction";

describe("redactLogContext", () => {
  it("redacts sensitive values recursively while preserving coarse context", () => {
    expect(
      redactLogContext({
        action: "health.ready",
        authorization: "Bearer secret",
        nested: { requestId: "req_01", token: "signed-value" },
      }),
    ).toEqual({
      action: "health.ready",
      authorization: "[REDACTED]",
      nested: { requestId: "req_01", token: "[REDACTED]" },
    });
  });

  it("does not serialize exception messages", () => {
    expect(redactLogContext({ error: new Error("contains a secret") })).toEqual({
      error: { name: "Error" },
    });
  });
});
