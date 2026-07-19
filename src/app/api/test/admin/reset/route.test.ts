import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { enabled, reset } = vi.hoisted(() => ({
  enabled: vi.fn(() => true),
  reset: vi.fn(),
}));

vi.mock("@/modules/admin/server", () => ({ resetAdminBrowserFixture: reset }));
vi.mock("@/modules/identity/server", () => ({ isFakeEmailHarnessEnabled: enabled }));

import { POST } from "./route";

function request(headers: Record<string, string> = {}) {
  return new NextRequest("http://film.example/api/test/admin/reset", {
    headers: { "x-film-test-harness": "1", ...headers },
    method: "POST",
  });
}

beforeEach(() => {
  enabled.mockReset();
  enabled.mockReturnValue(true);
  reset.mockReset();
  reset.mockResolvedValue(undefined);
});

describe("POST /api/test/admin/reset", () => {
  it("resets the deterministic fixture only inside the guarded fake harness", async () => {
    const response = await POST(request());

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(reset).toHaveBeenCalledOnce();
  });

  it.each([
    ["disabled harness", {}, false, 404],
    ["missing harness header", { "x-film-test-harness": "0" }, true, 404],
    ["cookie", { cookie: "session=private" }, true, 403],
    ["origin", { origin: "http://film.example" }, true, 403],
  ] as const)("rejects %s before mutation", async (_label, headers, isEnabled, status) => {
    enabled.mockReturnValueOnce(isEnabled);

    const response = await POST(request(headers));

    expect(response.status).toBe(status);
    expect(reset).not.toHaveBeenCalled();
  });

  it("returns no reset failure detail", async () => {
    reset.mockRejectedValueOnce(new Error("private database detail"));

    const response = await POST(request());

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.not.toContain("private database detail");
  });

  it("rejects a nonempty body before reset", async () => {
    const response = await POST(
      new NextRequest("http://film.example/api/test/admin/reset", {
        body: "not-allowed",
        headers: {
          "content-type": "text/plain",
          "x-film-test-harness": "1",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(403);
    expect(reset).not.toHaveBeenCalled();
  });
});
