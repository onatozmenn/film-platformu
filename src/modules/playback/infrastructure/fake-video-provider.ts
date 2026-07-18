import { z } from "zod";

import {
  VideoProviderError,
  type VerifiedVideoEvent,
  type VideoProviderPort,
} from "../application/playback-ports";

const fixtureSourceUrl = "/fixtures/playback/guest-feature.mp4";
const fakeWebhookSchema = z.discriminatedUnion("eventType", [
  z.object({
    durationSeconds: z.number().int().positive().nullable(),
    eventId: z.string().min(1).max(160),
    eventType: z.enum(["ASSET_CREATED", "ASSET_ERRORED", "ASSET_READY"]),
    playbackId: z.string().min(1).max(120).nullable(),
    providerAssetId: z.string().min(1).max(120),
  }),
  z.object({
    durationSeconds: z.null(),
    eventId: z.string().min(1).max(160),
    eventType: z.literal("ASSET_DELETED"),
    playbackId: z.null(),
    providerAssetId: z.string().min(1).max(120),
  }),
  z.object({
    eventId: z.string().min(1).max(160),
    eventType: z.literal("UNSUPPORTED"),
    providerEventType: z.string().min(1).max(120),
  }),
]);

export const fakeVideoProvider: VideoProviderPort = {
  async createPlaybackGrant(input) {
    if (input.playbackId === "fake-playback-provider-error") {
      throw new VideoProviderError("UNAVAILABLE");
    }

    return {
      fixtureSourceUrl,
      fixtureTextTracks: [
        {
          default: true,
          kind: "captions",
          label: "Türkçe",
          languageTag: "tr",
          src: "/fixtures/playback/guest-feature-tr.vtt",
        },
      ],
      token: `fake_${input.sessionId}`,
    };
  },

  async getAsset(providerAssetId) {
    if (!providerAssetId.startsWith("fake-asset-")) {
      return null;
    }

    return {
      durationSeconds: 6,
      playbackId: providerAssetId.replace("fake-asset-", "fake-playback-"),
      providerAssetId,
      state: providerAssetId.endsWith("draft-preparing") ? "PREPARING" : "READY",
    };
  },

  async verifyWebhook(rawBody): Promise<VerifiedVideoEvent> {
    try {
      const parsed = fakeWebhookSchema.safeParse(JSON.parse(rawBody) as unknown);
      if (!parsed.success) {
        throw new VideoProviderError("INVALID_WEBHOOK");
      }
      return parsed.data;
    } catch (error) {
      if (error instanceof VideoProviderError) {
        throw error;
      }
      throw new VideoProviderError("INVALID_WEBHOOK");
    }
  },
};
