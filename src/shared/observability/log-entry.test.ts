import { describe, expect, it } from "vitest";

import { createLogEntry } from "./log-entry";

describe("structured log entry", () => {
  it("redacts context and preserves owned correlation fields", () => {
    expect(
      createLogEntry({
        context: {
          event: "spoofed.event",
          releaseId: "spoofed-release",
          requestId: "req_01",
          token: "private-token",
        },
        event: "catalog.completed",
        level: "info",
        releaseId: "release-abcdef1",
        timestamp: new Date("2026-07-19T12:00:00.000Z"),
      }),
    ).toEqual({
      event: "catalog.completed",
      level: "info",
      releaseId: "release-abcdef1",
      requestId: "req_01",
      timestamp: "2026-07-19T12:00:00.000Z",
      token: "[REDACTED]",
    });
  });
});
