import { afterEach, describe, expect, it, vi } from "vitest";

import { reportAdvertisingOutcome } from "./report-ad-outcome";

afterEach(() => vi.unstubAllGlobals());

describe("advertising outcome reporter", () => {
  it("sends only the coarse session outcome as a best-effort request", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      reportAdvertisingOutcome({ outcome: "empty", sessionId: "ps_opaque" }),
    ).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/advertising/outcomes",
      expect.objectContaining({
        body: JSON.stringify({ outcome: "empty", sessionId: "ps_opaque" }),
        keepalive: true,
        method: "POST",
      }),
    );
  });

  it("never throws when telemetry is blocked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("blocked"))),
    );

    await expect(
      reportAdvertisingOutcome({ outcome: "blocked", sessionId: "ps_opaque" }),
    ).resolves.toBe(false);
  });
});
