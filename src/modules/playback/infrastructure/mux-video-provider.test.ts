import { createHmac, generateKeyPairSync } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { VideoProviderEnvironment } from "@/shared/config/server-environment-schema";

import { createMuxVideoProvider, type MuxVideoClient } from "./mux-video-provider";

const webhookSecret = "synthetic-webhook-secret";
const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2_048,
  privateKeyEncoding: { format: "pem", type: "pkcs8" },
  publicKeyEncoding: { format: "pem", type: "spki" },
});
const config: Extract<VideoProviderEnvironment, { kind: "mux" }> = {
  kind: "mux",
  signingKeyId: "synthetic-signing-key",
  signingPrivateKey: privateKey,
  tokenId: "synthetic-management-id",
  tokenSecret: "synthetic-management-secret",
  webhookSecret,
};
const now = new Date("2026-07-19T12:00:00.000Z");

function signedHeaders(body: string, timestamp: number): Headers {
  const signature = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return new Headers({ "mux-signature": `t=${timestamp},v1=${signature}` });
}

function clientWithAsset(asset: unknown): MuxVideoClient {
  return {
    jwt: { signPlaybackId: vi.fn(async () => "token") },
    video: { assets: { retrieve: vi.fn(async () => asset) } },
    webhooks: { unwrap: vi.fn(async () => ({})) },
  };
}

afterEach(() => vi.useRealTimers());

describe("Mux video provider", () => {
  it("uses the official signer with an exact bounded expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const provider = createMuxVideoProvider(config);

    const grant = await provider.createPlaybackGrant({
      expiresAt: new Date("2026-07-19T12:05:00.000Z"),
      lifetimeSeconds: 300,
      playbackId: "signed-playback-id",
      sessionId: "ps_opaque",
    });
    const payloadPart = grant.token.split(".")[1];
    expect(payloadPart).toBeDefined();
    const payload = z
      .object({ aud: z.string(), exp: z.number(), sub: z.string() })
      .parse(JSON.parse(Buffer.from(payloadPart ?? "", "base64url").toString("utf8")) as unknown);

    expect(payload).toMatchObject({
      aud: "v",
      exp: Math.floor(new Date("2026-07-19T12:05:00.000Z").getTime() / 1_000),
      sub: "signed-playback-id",
    });
  });

  it("maps only a signed playback ID from provider asset data", async () => {
    const provider = createMuxVideoProvider(
      config,
      clientWithAsset({
        duration: 98.4,
        id: "mux-asset",
        playback_ids: [
          { id: "public-id", policy: "public" },
          { id: "signed-id", policy: "signed" },
        ],
        status: "ready",
      }),
    );

    await expect(provider.getAsset("mux-asset")).resolves.toEqual({
      durationSeconds: 98,
      playbackId: "signed-id",
      providerAssetId: "mux-asset",
      state: "READY",
    });
  });

  it("verifies a synthetic raw webhook through the official Mux mechanism", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const provider = createMuxVideoProvider(config);
    const body = JSON.stringify({
      data: {
        duration: 98,
        id: "mux-asset",
        playback_ids: [{ id: "signed-id", policy: "signed" }],
      },
      id: "mux-event-ready",
      type: "video.asset.ready",
    });
    const timestamp = Math.floor(now.getTime() / 1_000);

    await expect(
      provider.verifyWebhook(body, signedHeaders(body, timestamp), now),
    ).resolves.toEqual({
      durationSeconds: 98,
      eventId: "mux-event-ready",
      eventType: "ASSET_READY",
      playbackId: "signed-id",
      providerAssetId: "mux-asset",
    });
    await expect(
      provider.verifyWebhook(body, signedHeaders(body, timestamp + 300), now),
    ).resolves.toMatchObject({ eventId: "mux-event-ready" });
  });

  it("rejects invalid signatures, future skew, and malformed verified data coarsely", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const provider = createMuxVideoProvider(config);
    const malformed = JSON.stringify({ id: "event", type: "video.asset.ready", data: {} });
    const timestamp = Math.floor(now.getTime() / 1_000);

    await expect(
      provider.verifyWebhook(
        malformed,
        new Headers({ "mux-signature": `t=${timestamp},v1=bad` }),
        now,
      ),
    ).rejects.toMatchObject({ code: "INVALID_WEBHOOK" });
    await expect(
      provider.verifyWebhook(malformed, signedHeaders(malformed, timestamp + 301), now),
    ).rejects.toMatchObject({ code: "INVALID_WEBHOOK" });
    await expect(
      provider.verifyWebhook(malformed, signedHeaders(malformed, timestamp), now),
    ).rejects.toMatchObject({ code: "INVALID_WEBHOOK" });
  });
});
