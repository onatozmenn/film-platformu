import { describe, expect, it } from "vitest";

import { problemResponse } from "./problem-details";

describe("problemResponse", () => {
  it("returns safe RFC 9457 JSON with correlation and no-store headers", async () => {
    const response = problemResponse("PLAYBACK_NOT_AVAILABLE", "req_test");

    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toBe("application/problem+json; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-request-id")).toBe("req_test");
    await expect(response.json()).resolves.toMatchObject({
      code: "PLAYBACK_NOT_AVAILABLE",
      detail: "Bu film şu anda oynatılamıyor.",
      requestId: "req_test",
      status: 403,
    });
  });
});
