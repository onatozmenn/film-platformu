import { describe, expect, it, vi } from "vitest";

import {
  VideoProviderError,
  type VideoProviderPort,
  type VideoWebhookRepositoryPort,
} from "./playback-ports";
import { createVideoWebhookService } from "./process-video-webhook";

describe("video webhook service", () => {
  it("verifies before applying and uses one injected clock value", async () => {
    const calls: string[] = [];
    const event = {
      durationSeconds: 5_880,
      eventId: "event-ready",
      eventType: "ASSET_READY" as const,
      playbackId: "signed-playback-id",
      providerAssetId: "provider-asset-id",
    };
    const videoProvider: VideoProviderPort = {
      createPlaybackGrant: vi.fn(async () => ({ token: "token" })),
      getAsset: vi.fn(async () => null),
      verifyWebhook: vi.fn(async () => {
        calls.push("verify");
        return event;
      }),
    };
    const repository: VideoWebhookRepositoryPort = {
      applyVerifiedEvent: vi.fn(async () => {
        calls.push("apply");
        return "applied" as const;
      }),
    };
    const clock = vi.fn(() => new Date("2026-07-19T12:00:00.000Z"));
    const service = createVideoWebhookService({ clock, repository, videoProvider });

    await expect(service.process("raw-body", new Headers())).resolves.toBe("applied");
    expect(calls).toEqual(["verify", "apply"]);
    expect(clock).toHaveBeenCalledOnce();
  });

  it("does not reach persistence when verification fails", async () => {
    const videoProvider: VideoProviderPort = {
      createPlaybackGrant: vi.fn(async () => ({ token: "token" })),
      getAsset: vi.fn(async () => null),
      verifyWebhook: vi.fn(async () => {
        throw new VideoProviderError("INVALID_WEBHOOK");
      }),
    };
    const repository: VideoWebhookRepositoryPort = {
      applyVerifiedEvent: vi.fn(async () => "applied" as const),
    };
    const service = createVideoWebhookService({
      clock: () => new Date("2026-07-19T12:00:00.000Z"),
      repository,
      videoProvider,
    });

    await expect(service.process("raw-body", new Headers())).resolves.toBe("invalid");
    expect(repository.applyVerifiedEvent).not.toHaveBeenCalled();
  });
});
