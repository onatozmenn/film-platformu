import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { consumeRateLimit, createSession, resolveTerritory } = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(() => true),
  createSession: vi.fn(),
  resolveTerritory: vi.fn(() => "TR"),
}));

vi.mock("@/modules/playback/server", () => ({
  playbackService: { createSession },
  playbackSessionRateLimiter: { consume: consumeRateLimit },
  territoryResolver: { resolve: resolveTerritory },
}));
vi.mock("@/shared/config/server-environment", () => ({
  getServerEnvironment: () => ({ siteOrigin: "https://film.example" }),
}));

import { POST } from "./route";

const movieId = "00000000-0000-4000-8000-000000000001";

function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("https://film.example/api/v1/playback/sessions", {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json; charset=utf-8",
      host: "film.example",
      origin: "https://film.example",
      "x-request-id": "req_route_test",
      ...headers,
    },
    method: "POST",
  });
}

beforeEach(() => {
  consumeRateLimit.mockReset();
  consumeRateLimit.mockReturnValue(true);
  createSession.mockReset();
  resolveTerritory.mockClear();
});

describe("POST /api/v1/playback/sessions", () => {
  it("returns the narrow private session response using server-resolved territory", async () => {
    createSession.mockResolvedValue({
      kind: "success",
      session: {
        advertising: null,
        movie: { durationSeconds: 5_880, id: movieId, title: "Kıyıdaki Sessizlik" },
        playback: {
          expiresAt: "2026-07-19T12:05:00.000Z",
          fixtureSourceUrl: "/fixtures/playback/guest-feature.mp4",
          playbackId: "fake-playback-kiyidaki-sessizlik",
          provider: "mux",
          token: "fake_ps_opaque",
        },
        resumeAtSeconds: 0,
        sessionId: "ps_opaque",
      },
    });

    const response = await POST(request({ movieId }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-request-id")).toBe("req_route_test");
    expect(resolveTerritory).toHaveBeenCalledOnce();
    expect(createSession).toHaveBeenCalledWith(movieId, "TR");
    await expect(response.json()).resolves.toMatchObject({
      data: { advertising: null, sessionId: "ps_opaque" },
    });
  });

  it("rejects cross-origin requests before resolving territory", async () => {
    const response = await POST(request({ movieId }, { origin: "https://attacker.example" }));

    expect(response.status).toBe(403);
    expect(resolveTerritory).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  it("returns a private 429 before parsing or signing when the request budget is exhausted", async () => {
    consumeRateLimit.mockReturnValue(false);

    const response = await POST(request({ movieId }));

    expect(response.status).toBe(429);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(resolveTerritory).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  it.each([
    ["territory", { movieId, territory: "TR" }],
    ["asset ID", { assetId: "asset", movieId }],
    ["provider ID", { movieId, playbackId: "provider-id" }],
    ["consent", { consent: true, movieId }],
    ["invalid movie ID", { movieId: "not-a-uuid" }],
  ])("rejects client-supplied %s", async (_label, body) => {
    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect(createSession).not.toHaveBeenCalled();
  });

  it.each([
    ["not-found", 404, "NOT_FOUND"],
    ["not-available", 403, "PLAYBACK_NOT_AVAILABLE"],
    ["provider-unavailable", 503, "PROVIDER_UNAVAILABLE"],
  ] as const)("maps %s without leaking internal policy", async (kind, status, code) => {
    createSession.mockResolvedValue({ kind });

    const response = await POST(request({ movieId }));

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ code, requestId: "req_route_test" });
  });
});
