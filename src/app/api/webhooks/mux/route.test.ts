import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { processWebhook } = vi.hoisted(() => ({ processWebhook: vi.fn() }));

vi.mock("@/modules/playback/server", () => ({
  videoWebhookService: { process: processWebhook },
}));

import { POST } from "./route";

function request(body: string, headers: Record<string, string> = {}) {
  return new NextRequest("https://film.example/api/webhooks/mux", {
    body,
    headers: {
      "content-type": "application/json",
      "mux-signature": "t=1,v1=synthetic",
      "x-request-id": "req_webhook_test",
      ...headers,
    },
    method: "POST",
  });
}

beforeEach(() => processWebhook.mockReset());

describe("POST /api/webhooks/mux", () => {
  it.each(["applied", "duplicate", "ignored"])(
    "acknowledges a verified %s outcome without echoing provider data",
    async (result) => {
      processWebhook.mockResolvedValue(result);
      const rawBody = JSON.stringify({ private: "provider-payload" });

      const response = await POST(request(rawBody));

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(processWebhook).toHaveBeenCalledWith(rawBody, expect.any(Headers));
      await expect(response.json()).resolves.toEqual({ received: true });
    },
  );

  it("accepts a verified unknown asset for later reconciliation", async () => {
    processWebhook.mockResolvedValue("asset-not-found");

    const response = await POST(request("{}"));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ received: true });
  });

  it("rejects an invalid signature without leaking its reason", async () => {
    processWebhook.mockResolvedValue("invalid");

    const response = await POST(request("{}"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "VALIDATION_FAILED",
      requestId: "req_webhook_test",
    });
  });

  it("rejects oversized bodies before verification", async () => {
    const response = await POST(request("x".repeat(256 * 1_024 + 1)));

    expect(response.status).toBe(400);
    expect(processWebhook).not.toHaveBeenCalled();
  });

  it("does not require a browser origin header", async () => {
    processWebhook.mockResolvedValue("ignored");

    const response = await POST(request("{}"));

    expect(response.status).toBe(200);
  });
});
