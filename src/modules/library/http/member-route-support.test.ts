import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { getOptionalMemberSession } = vi.hoisted(() => ({
  getOptionalMemberSession: vi.fn(),
}));

vi.mock("@/modules/identity/server", () => ({ getOptionalMemberSession }));
vi.mock("@/shared/config/server-environment", () => ({
  getServerEnvironment: () => ({ siteOrigin: "https://film.example" }),
}));

import {
  authorizeMemberMovieRequest,
  libraryMutationResponse,
  readBoundedJson,
} from "./member-route-support";

const movieId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";

function request(body?: string, headers: Record<string, string> = {}) {
  return new NextRequest(`https://film.example/api/v1/me/progress/${movieId}`, {
    ...(body === undefined ? {} : { body }),
    headers: {
      host: "film.example",
      origin: "https://film.example",
      "x-request-id": "req_member_route",
      ...headers,
    },
    method: body === undefined ? "DELETE" : "PUT",
  });
}

beforeEach(() => {
  getOptionalMemberSession.mockReset();
  getOptionalMemberSession.mockResolvedValue({
    expires: "2026-08-18T00:00:00.000Z",
    user: { displayName: "Film üyesi", id: userId, roles: ["MEMBER"] },
  });
});

describe("member route support", () => {
  it("resolves the actor only from a same-origin member session", async () => {
    await expect(
      authorizeMemberMovieRequest(request(), { params: Promise.resolve({ movieId }) }),
    ).resolves.toEqual({ movieId, requestId: "req_member_route", userId });
  });

  it("rejects cross-origin, unauthenticated, and invalid-object requests", async () => {
    const forbidden = await authorizeMemberMovieRequest(
      request(undefined, { origin: "https://attacker.example" }),
      { params: Promise.resolve({ movieId }) },
    );
    expect(forbidden).toBeInstanceOf(Response);
    expect((forbidden as Response).status).toBe(403);

    getOptionalMemberSession.mockResolvedValueOnce(null);
    const unauthenticated = await authorizeMemberMovieRequest(request(), {
      params: Promise.resolve({ movieId }),
    });
    expect(unauthenticated).toBeInstanceOf(Response);
    expect((unauthenticated as Response).status).toBe(401);

    const invalid = await authorizeMemberMovieRequest(request(), {
      params: Promise.resolve({ movieId: "not-a-uuid" }),
    });
    expect(invalid).toBeInstanceOf(Response);
    expect((invalid as Response).status).toBe(400);
  });

  it("accepts only bounded strict JSON", async () => {
    const schema = z.object({ value: z.number() }).strict();

    await expect(
      readBoundedJson(
        request('{"value":1}', { "content-type": "application/json; charset=utf-8" }),
        schema,
      ),
    ).resolves.toEqual({ value: 1 });
    await expect(
      readBoundedJson(
        request('{"value":1,"userId":"other"}', { "content-type": "application/json" }),
        schema,
      ),
    ).resolves.toBeNull();
    await expect(
      readBoundedJson(request("{".repeat(600), { "content-type": "application/json" }), schema),
    ).resolves.toBeNull();
    await expect(readBoundedJson(request('{"value":1}'), schema)).resolves.toBeNull();
  });

  it.each([
    ["success", 204],
    ["stale", 204],
    ["conflict", 409],
    ["forbidden", 403],
    ["invalid", 400],
    ["not-found", 404],
  ] as const)("maps %s without caching", (kind, status) => {
    const response = libraryMutationResponse({ kind }, "req_member_route");

    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-request-id")).toBe("req_member_route");
  });
});
