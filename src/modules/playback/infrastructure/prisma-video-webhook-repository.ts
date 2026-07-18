import type { PrismaClient } from "@/generated/prisma/client";

import type {
  ApplyVideoEventResult,
  VerifiedVideoEvent,
  VideoWebhookRepositoryPort,
} from "../application/playback-ports";

function eventType(event: VerifiedVideoEvent): string {
  return event.eventType === "UNSUPPORTED" ? event.providerEventType : event.eventType;
}

export function createPrismaVideoWebhookRepository(
  client: PrismaClient,
): VideoWebhookRepositoryPort {
  return {
    async applyVerifiedEvent(event): Promise<ApplyVideoEventResult> {
      return client.$transaction(async (transaction) => {
        const inserted = await transaction.processedWebhook.createMany({
          data: [
            {
              eventType: eventType(event),
              provider: "MUX",
              providerEventId: event.eventId,
            },
          ],
          skipDuplicates: true,
        });
        if (inserted.count === 0) {
          return "duplicate";
        }

        if (event.eventType === "UNSUPPORTED") {
          return "ignored";
        }

        const asset = await transaction.videoAsset.findUnique({
          where: {
            provider_providerAssetId: {
              provider: "MUX",
              providerAssetId: event.providerAssetId,
            },
          },
        });
        if (asset === null) {
          return "asset-not-found";
        }

        switch (event.eventType) {
          case "ASSET_CREATED":
            return asset.state === "PREPARING" ? "applied" : "ignored";
          case "ASSET_READY":
            if (
              asset.state === "DISABLED" ||
              asset.state === "ERRORED" ||
              event.durationSeconds === null ||
              event.playbackId === null
            ) {
              return "ignored";
            }
            await transaction.videoAsset.update({
              where: { id: asset.id },
              data: {
                durationSeconds: event.durationSeconds,
                providerPlaybackId: event.playbackId,
                state: "READY",
              },
            });
            return "applied";
          case "ASSET_ERRORED":
            if (asset.state === "DISABLED" || asset.state === "ERRORED") {
              return "ignored";
            }
            await transaction.videoAsset.update({
              where: { id: asset.id },
              data: { isActive: false, state: "ERRORED" },
            });
            return "applied";
          case "ASSET_DELETED":
            if (asset.state === "DISABLED") {
              return "ignored";
            }
            await transaction.videoAsset.update({
              where: { id: asset.id },
              data: { isActive: false, state: "DISABLED" },
            });
            return "applied";
        }
      });
    },
  };
}
