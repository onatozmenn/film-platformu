import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { error, info, publishDue, warn } = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  publishDue: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/modules/admin/server", () => ({
  adminCommandService: { publishDue },
}));
vi.mock("@/shared/config/internal-jobs-server", () => ({
  getInternalJobsEnvironment: () => ({
    batchLimit: 100,
    cronSecret: "c".repeat(32),
    kind: "enabled",
    nodeEnvironment: "production",
    publicationBatchLimit: 10,
  }),
}));
vi.mock("@/shared/observability/logger", () => ({ logger: { error, info, warn } }));

import { POST } from "./route";

function request(
  authorization: string | null = `Bearer ${"c".repeat(32)}`,
  headers: Record<string, string> = {},
  url: string = "https://film.example/api/internal/publish-due",
) {
  return new NextRequest(url, {
    headers: {
      ...(authorization === null ? {} : { authorization }),
      "x-request-id": "req_publish_due",
      ...headers,
    },
    method: "POST",
  });
}

beforeEach(() => {
  publishDue.mockReset();
  publishDue.mockResolvedValue({ examined: 3, failed: 0, published: 2, skipped: 1 });
  info.mockReset();
  error.mockReset();
  warn.mockReset();
});

describe("POST /api/internal/publish-due", () => {
  it("runs one bounded aggregate-only publication batch", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(publishDue).toHaveBeenCalledWith("req_publish_due");
    await expect(response.json()).resolves.toEqual({
      examined: 3,
      failed: 0,
      published: 2,
      skipped: 1,
    });
    expect(info).toHaveBeenCalledWith(
      "publication.completed",
      expect.objectContaining({ examined: 3, published: 2, requestId: "req_publish_due" }),
    );
  });

  it.each([
    ["missing credential", null, {}, "https://film.example/api/internal/publish-due", 401],
    ["wrong credential", "Bearer wrong", {}, "https://film.example/api/internal/publish-due", 401],
    [
      "cookie",
      `Bearer ${"c".repeat(32)}`,
      { cookie: "session=private" },
      "https://film.example/api/internal/publish-due",
      403,
    ],
    [
      "origin",
      `Bearer ${"c".repeat(32)}`,
      { origin: "https://film.example" },
      "https://film.example/api/internal/publish-due",
      403,
    ],
    [
      "query date",
      `Bearer ${"c".repeat(32)}`,
      {},
      "https://film.example/api/internal/publish-due?now=2026-01-01",
      403,
    ],
    [
      "insecure production transport",
      `Bearer ${"c".repeat(32)}`,
      {},
      "http://film.example/api/internal/publish-due",
      403,
    ],
  ] as const)("rejects %s before work", async (_label, authorization, headers, url, status) => {
    const response = await POST(request(authorization, headers, url));

    expect(response.status).toBe(status);
    expect(publishDue).not.toHaveBeenCalled();
  });

  it("returns no internal failure details", async () => {
    publishDue.mockRejectedValueOnce(new Error("private film detail"));

    const response = await POST(request());

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.not.toContain("private film detail");
    expect(error).toHaveBeenCalledWith("publication.failed", { requestId: "req_publish_due" });
  });

  it("logs only aggregate context when a bounded batch partially fails", async () => {
    publishDue.mockResolvedValueOnce({ examined: 3, failed: 1, published: 1, skipped: 1 });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(warn).toHaveBeenCalledWith(
      "publication.partial",
      expect.objectContaining({ failed: 1, published: 1, requestId: "req_publish_due" }),
    );
    expect(info).not.toHaveBeenCalled();
  });
});
