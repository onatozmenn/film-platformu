import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { error, info, purgeDueAccounts, warn } = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  purgeDueAccounts: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/modules/identity/server", () => ({
  accountLifecycleService: { purgeDueAccounts },
}));
vi.mock("@/shared/config/internal-jobs-server", () => ({
  getInternalJobsEnvironment: () => ({
    batchLimit: 25,
    cronSecret: "c".repeat(32),
    kind: "enabled",
    nodeEnvironment: "production",
  }),
}));
vi.mock("@/shared/observability/logger", () => ({ logger: { error, info, warn } }));

import { POST } from "./route";

function request(
  authorization: string | null = `Bearer ${"c".repeat(32)}`,
  headers: Record<string, string> = {},
  url: string = "https://film.example/api/internal/run-retention",
) {
  return new NextRequest(url, {
    headers: {
      ...(authorization === null ? {} : { authorization }),
      "x-request-id": "req_retention",
      ...headers,
    },
    method: "POST",
  });
}

beforeEach(() => {
  purgeDueAccounts.mockReset();
  purgeDueAccounts.mockResolvedValue({ examined: 2, failed: 0, purged: 1, skipped: 1 });
  info.mockReset();
  error.mockReset();
  warn.mockReset();
});

describe("POST /api/internal/run-retention", () => {
  it("runs one bounded aggregate-only retention batch", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(purgeDueAccounts).toHaveBeenCalledWith(25);
    await expect(response.json()).resolves.toEqual({
      examined: 2,
      failed: 0,
      purged: 1,
      skipped: 1,
    });
    expect(info).toHaveBeenCalledWith(
      "retention.completed",
      expect.objectContaining({ examined: 2, purged: 1, requestId: "req_retention" }),
    );
  });

  it.each([
    ["missing credential", null, {}, "https://film.example/api/internal/run-retention", 401],
    [
      "wrong credential",
      "Bearer wrong",
      {},
      "https://film.example/api/internal/run-retention",
      401,
    ],
    [
      "cookie",
      `Bearer ${"c".repeat(32)}`,
      { cookie: "session=private" },
      "https://film.example/api/internal/run-retention",
      403,
    ],
    [
      "origin",
      `Bearer ${"c".repeat(32)}`,
      { origin: "https://film.example" },
      "https://film.example/api/internal/run-retention",
      403,
    ],
    [
      "query date",
      `Bearer ${"c".repeat(32)}`,
      {},
      "https://film.example/api/internal/run-retention?now=2026-01-01",
      403,
    ],
    [
      "insecure production transport",
      `Bearer ${"c".repeat(32)}`,
      {},
      "http://film.example/api/internal/run-retention",
      403,
    ],
  ] as const)("rejects %s before work", async (_label, authorization, headers, url, status) => {
    const response = await POST(request(authorization, headers, url));

    expect(response.status).toBe(status);
    expect(purgeDueAccounts).not.toHaveBeenCalled();
  });

  it("returns no internal failure details", async () => {
    purgeDueAccounts.mockRejectedValueOnce(new Error("private member detail"));

    const response = await POST(request());

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.not.toContain("private member detail");
    expect(error).toHaveBeenCalledWith("retention.failed", { requestId: "req_retention" });
  });

  it("logs only aggregate context when a bounded batch partially fails", async () => {
    purgeDueAccounts.mockResolvedValueOnce({ examined: 2, failed: 1, purged: 1, skipped: 0 });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(warn).toHaveBeenCalledWith(
      "retention.partial",
      expect.objectContaining({ failed: 1, purged: 1, requestId: "req_retention" }),
    );
    expect(info).not.toHaveBeenCalled();
  });
});
