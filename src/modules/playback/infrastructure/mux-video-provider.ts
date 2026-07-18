import Mux, { NotFoundError } from "@mux/mux-node";
import { z } from "zod";

import type { VideoProviderEnvironment } from "@/shared/config/server-environment-schema";

import {
  VideoProviderError,
  type VerifiedVideoEvent,
  type VideoProviderPort,
} from "../application/playback-ports";

type MuxConfig = Extract<VideoProviderEnvironment, { kind: "mux" }>;

export type MuxVideoClient = Readonly<{
  jwt: Readonly<{
    signPlaybackId(
      playbackId: string,
      config: Readonly<{ expiration: string; type: "video" }>,
    ): Promise<string>;
  }>;
  video: Readonly<{
    assets: Readonly<{
      retrieve(providerAssetId: string): Promise<unknown>;
    }>;
  }>;
  webhooks: Readonly<{
    unwrap(rawBody: string, headers: Headers): Promise<unknown>;
  }>;
}>;

const assetSchema = z.object({
  duration: z
    .number()
    .positive()
    .max(12 * 60 * 60)
    .optional(),
  id: z.string().min(1).max(255),
  playback_ids: z
    .array(
      z.object({
        id: z.string().min(1).max(255),
        policy: z.enum(["drm", "public", "signed"]),
      }),
    )
    .max(20)
    .optional(),
  status: z.enum(["errored", "preparing", "ready"]),
});
const webhookEnvelopeSchema = z.object({
  data: z.unknown(),
  id: z.string().min(1).max(160),
  type: z.string().min(1).max(120),
});
const webhookAssetSchema = z.object({
  duration: z
    .number()
    .positive()
    .max(12 * 60 * 60)
    .optional(),
  id: z.string().min(1).max(255),
  playback_ids: z
    .array(
      z.object({
        id: z.string().min(1).max(255),
        policy: z.enum(["drm", "public", "signed"]),
      }),
    )
    .max(20)
    .optional(),
});

function createSdkClient(config: MuxConfig): MuxVideoClient {
  const sdk = new Mux({
    jwtPrivateKey: config.signingPrivateKey,
    jwtSigningKey: config.signingKeyId,
    logLevel: "off",
    maxRetries: 0,
    timeout: 5_000,
    tokenId: config.tokenId,
    tokenSecret: config.tokenSecret,
    webhookSecret: config.webhookSecret,
  });

  return {
    jwt: {
      signPlaybackId: (playbackId, options) => sdk.jwt.signPlaybackId(playbackId, options),
    },
    video: {
      assets: {
        retrieve: (providerAssetId) => sdk.video.assets.retrieve(providerAssetId),
      },
    },
    webhooks: {
      unwrap: (rawBody, headers) => sdk.webhooks.unwrap(rawBody, headers),
    },
  };
}

function playbackIdFor(asset: z.infer<typeof assetSchema>): string | null {
  return asset.playback_ids?.find((playback) => playback.policy === "signed")?.id ?? null;
}

function durationSeconds(value: number | undefined): number | null {
  return value === undefined ? null : Math.round(value);
}

function assetState(value: z.infer<typeof assetSchema>["status"]) {
  switch (value) {
    case "errored":
      return "ERRORED" as const;
    case "preparing":
      return "PREPARING" as const;
    case "ready":
      return "READY" as const;
  }
}

function ownedEventType(value: string) {
  switch (value) {
    case "video.asset.created":
      return "ASSET_CREATED" as const;
    case "video.asset.errored":
      return "ASSET_ERRORED" as const;
    case "video.asset.ready":
      return "ASSET_READY" as const;
    default:
      return null;
  }
}

function signatureTimestamp(headers: Headers): number | null {
  const header = headers.get("mux-signature");
  if (header === null) {
    return null;
  }
  const timestampPart = header.split(",").find((part) => part.startsWith("t="));
  if (timestampPart === undefined) {
    return null;
  }
  const value = Number(timestampPart.slice(2));
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function mapWebhookEvent(value: unknown): VerifiedVideoEvent {
  const envelope = webhookEnvelopeSchema.safeParse(value);
  if (!envelope.success) {
    throw new VideoProviderError("INVALID_WEBHOOK");
  }

  const ownedType = ownedEventType(envelope.data.type);
  if (ownedType !== null) {
    const asset = webhookAssetSchema.safeParse(envelope.data.data);
    if (!asset.success) {
      throw new VideoProviderError("INVALID_WEBHOOK");
    }
    return {
      durationSeconds: durationSeconds(asset.data.duration),
      eventId: envelope.data.id,
      eventType: ownedType,
      playbackId: playbackIdFor({ ...asset.data, status: "ready" }),
      providerAssetId: asset.data.id,
    };
  }

  if (envelope.data.type === "video.asset.deleted") {
    const deleted = z.object({ id: z.string().min(1).max(255) }).safeParse(envelope.data.data);
    if (!deleted.success) {
      throw new VideoProviderError("INVALID_WEBHOOK");
    }
    return {
      durationSeconds: null,
      eventId: envelope.data.id,
      eventType: "ASSET_DELETED",
      playbackId: null,
      providerAssetId: deleted.data.id,
    };
  }

  return {
    eventId: envelope.data.id,
    eventType: "UNSUPPORTED",
    providerEventType: envelope.data.type,
  };
}

export function createMuxVideoProvider(
  config: MuxConfig,
  client: MuxVideoClient = createSdkClient(config),
): VideoProviderPort {
  return {
    async createPlaybackGrant(input) {
      if (input.lifetimeSeconds < 1 || input.lifetimeSeconds > 5 * 60) {
        throw new VideoProviderError("UNAVAILABLE");
      }

      try {
        const token = await client.jwt.signPlaybackId(input.playbackId, {
          expiration: `${input.lifetimeSeconds}s`,
          type: "video",
        });
        return { token };
      } catch {
        throw new VideoProviderError("UNAVAILABLE");
      }
    },

    async getAsset(providerAssetId) {
      try {
        const parsed = assetSchema.safeParse(await client.video.assets.retrieve(providerAssetId));
        if (!parsed.success) {
          throw new VideoProviderError("UNAVAILABLE");
        }
        return {
          durationSeconds: durationSeconds(parsed.data.duration),
          playbackId: playbackIdFor(parsed.data),
          providerAssetId: parsed.data.id,
          state: assetState(parsed.data.status),
        };
      } catch (error) {
        if (error instanceof NotFoundError) {
          return null;
        }
        if (error instanceof VideoProviderError) {
          throw error;
        }
        throw new VideoProviderError("UNAVAILABLE");
      }
    },

    async verifyWebhook(rawBody, headers, now) {
      const timestamp = signatureTimestamp(headers);
      if (timestamp === null) {
        throw new VideoProviderError("INVALID_WEBHOOK");
      }

      try {
        const event = await client.webhooks.unwrap(rawBody, headers);
        if (Math.abs(Math.floor(now.getTime() / 1_000) - timestamp) > 300) {
          throw new VideoProviderError("INVALID_WEBHOOK");
        }
        return mapWebhookEvent(event);
      } catch (error) {
        if (error instanceof VideoProviderError) {
          throw error;
        }
        throw new VideoProviderError("INVALID_WEBHOOK");
      }
    },
  };
}
