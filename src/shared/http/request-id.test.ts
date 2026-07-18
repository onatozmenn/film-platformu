import { describe, expect, it } from "vitest";

import { resolveRequestId } from "./request-id";

const generatedRequestId = "req_generated";

describe("resolveRequestId", () => {
  it("accepts a valid ID only from trusted infrastructure", () => {
    const headers = new Headers({ "x-request-id": "edge_01HQ.TEST" });

    expect(resolveRequestId(headers, true, () => generatedRequestId)).toBe("edge_01HQ.TEST");
    expect(resolveRequestId(headers, false, () => generatedRequestId)).toBe(generatedRequestId);
  });

  it("replaces malformed trusted IDs", () => {
    const headers = new Headers({ "x-request-id": "bad value with spaces" });

    expect(resolveRequestId(headers, true, () => generatedRequestId)).toBe(generatedRequestId);
  });
});
