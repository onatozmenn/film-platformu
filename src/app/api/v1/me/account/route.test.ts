import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getOptionalMemberSession, invalidate, requestDeletion, warn } = vi.hoisted(() => ({
  getOptionalMemberSession: vi.fn(),
  invalidate: vi.fn(),
  requestDeletion: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/modules/catalog/server", () => ({ catalogInvalidation: { invalidate } }));
vi.mock("@/modules/identity/server", () => ({
  accountLifecycleService: { requestDeletion },
  getOptionalMemberSession,
}));
vi.mock("@/shared/config/server-environment", () => ({
  getServerEnvironment: () => ({ siteOrigin: "https://film.example" }),
}));
vi.mock("@/shared/observability/logger", () => ({ logger: { warn } }));

import { DELETE } from "./route";

const userId = "00000000-0000-4000-8000-000000000002";

function request(origin: string = "https://film.example") {
  return new NextRequest("https://film.example/api/v1/me/account", {
    headers: { host: "film.example", origin, "x-request-id": "req_delete_account" },
    method: "DELETE",
  });
}

beforeEach(() => {
  getOptionalMemberSession.mockReset();
  getOptionalMemberSession.mockResolvedValue({
    expires: "2026-08-18T00:00:00.000Z",
    user: { displayName: "Film üyesi", id: userId, roles: ["MEMBER"] },
  });
  invalidate.mockReset();
  requestDeletion.mockReset();
  warn.mockReset();
});

describe("DELETE /api/v1/me/account", () => {
  it("derives actor and owner from the database session", async () => {
    requestDeletion.mockResolvedValue({ kind: "success" });

    const response = await DELETE(request());

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("set-cookie")).toContain("next-auth.session-token=");
    expect(response.headers.get("set-cookie")).toContain("__Secure-next-auth.session-token=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(invalidate).toHaveBeenCalledWith({});
    expect(requestDeletion).toHaveBeenCalledWith({ actorUserId: userId, ownerUserId: userId });
  });

  it.each([
    ["final-admin", 409],
    ["forbidden", 403],
    ["not-found", 404],
  ] as const)("maps %s without leaking account data", async (kind, status) => {
    requestDeletion.mockResolvedValue({ kind });

    const response = await DELETE(request());

    expect(response.status).toBe(status);
    await expect(response.text()).resolves.not.toContain(userId);
  });

  it("rejects browser CSRF and provider failures safely", async () => {
    const forbidden = await DELETE(request("https://attacker.example"));
    expect(forbidden.status).toBe(403);
    expect(requestDeletion).not.toHaveBeenCalled();

    requestDeletion.mockRejectedValueOnce(new Error("private database detail"));
    const failed = await DELETE(request());
    expect(failed.status).toBe(500);
    await expect(failed.text()).resolves.not.toContain("private database detail");
  });

  it("expires the session after deletion even when cache invalidation fails", async () => {
    requestDeletion.mockResolvedValueOnce({ kind: "success" });
    invalidate.mockImplementationOnce(() => {
      throw new Error("private cache detail");
    });

    const response = await DELETE(request());

    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(warn).toHaveBeenCalledWith("catalog.invalidation_failed", {
      outcome: "eventual-consistency",
      requestId: "req_delete_account",
    });
  });
});
