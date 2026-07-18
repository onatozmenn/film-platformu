import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { consumeRateLimit, info } = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(() => true),
  info: vi.fn(),
}));

vi.mock("@/modules/advertising/server", () => ({
  advertisingOutcomeRateLimiter: { consume: consumeRateLimit },
}));
vi.mock("@/shared/config/server-environment", () => ({
  getServerEnvironment: () => ({ siteOrigin: "https://film.example" }),
}));
vi.mock("@/shared/observability/logger", () => ({ logger: { info } }));

import { POST } from "./route";

function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("https://film.example/api/v1/advertising/outcomes", {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json; charset=utf-8",
      host: "film.example",
      origin: "https://film.example",
      "x-request-id": "req_ad_outcome",
      ...headers,
    },
    method: "POST",
  });
}

function rawRequest(body: string) {
  return new NextRequest("https://film.example/api/v1/advertising/outcomes", {
    body,
    headers: {
      "content-type": "application/json",
      host: "film.example",
      origin: "https://film.example",
      "x-request-id": "req_ad_outcome",
    },
    method: "POST",
  });
}

beforeEach(() => {
  consumeRateLimit.mockReset();
  consumeRateLimit.mockReturnValue(true);
  info.mockReset();
});

describe("POST /api/v1/advertising/outcomes", () => {
  it("records only one coarse validated outcome and returns no body", async () => {
    const response = await POST(request({ outcome: "completed", sessionId: "ps_opaque" }));

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.text()).resolves.toBe("");
    expect(info).toHaveBeenCalledWith("advertising.outcome", {
      outcome: "completed",
      requestId: "req_ad_outcome",
    });
  });

  it.each([
    ["provider URL", { outcome: "error", sessionId: "ps_opaque", tagUrl: "https://secret" }],
    [
      "movie ID",
      { movieId: "00000000-0000-4000-8000-000000000001", outcome: "error", sessionId: "ps_opaque" },
    ],
    ["unknown outcome", { outcome: "loaded", sessionId: "ps_opaque" }],
    ["invalid session", { outcome: "error", sessionId: "not-a-session" }],
  ])("rejects %s without logging", async (_label, body) => {
    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect(info).not.toHaveBeenCalled();
  });

  it("rejects cross-origin and over-budget requests before logging", async () => {
    const forbidden = await POST(
      request({ outcome: "error", sessionId: "ps_opaque" }, { origin: "https://attacker.example" }),
    );
    consumeRateLimit.mockReturnValue(false);
    const limited = await POST(request({ outcome: "error", sessionId: "ps_opaque" }));

    expect(forbidden.status).toBe(403);
    expect(limited.status).toBe(429);
    expect(info).not.toHaveBeenCalled();
  });

  it("maps malformed JSON to validation failure", async () => {
    const response = await POST(rawRequest("{"));

    expect(response.status).toBe(400);
    expect(info).not.toHaveBeenCalled();
  });
});
