import Mux, { NotFoundError } from "@mux/mux-node";
import { z } from "zod";

import type {
  OpenFilmProviderAsset,
  OpenFilmVideoIngestPort,
} from "@/modules/catalog/application/ingest-open-film";
import type { OpenFilm } from "@/modules/catalog/application/open-film-manifest";
import { createMovieSlug } from "@/modules/catalog/domain/catalog-text";

export type MuxOpenFilmClient = Readonly<{
  assets: Readonly<{
    create(input: unknown): Promise<unknown>;
    list(): AsyncIterable<unknown>;
    retrieve(assetId: string): Promise<unknown>;
  }>;
}>;

const muxAssetSchema = z.object({
  duration: z
    .number()
    .positive()
    .max(12 * 60 * 60)
    .optional(),
  id: z.string().min(1).max(255),
  meta: z.object({ external_id: z.string().max(128).optional() }).optional(),
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

function mapAsset(value: unknown): OpenFilmProviderAsset {
  const asset = muxAssetSchema.parse(value);
  return {
    durationSeconds: asset.duration === undefined ? null : Math.round(asset.duration),
    id: asset.id,
    playbackId:
      asset.playback_ids?.find((playbackId) => playbackId.policy === "signed")?.id ?? null,
    state:
      asset.status === "ready" ? "READY" : asset.status === "errored" ? "ERRORED" : "PREPARING",
  };
}

function createSdkClient(tokenId: string, tokenSecret: string): MuxOpenFilmClient {
  const sdk = new Mux({ logLevel: "off", maxRetries: 1, timeout: 10_000, tokenId, tokenSecret });
  return {
    assets: {
      create: (input) =>
        sdk.video.assets.create(input as Parameters<typeof sdk.video.assets.create>[0]),
      list: () => sdk.video.assets.list({ limit: 100 }),
      retrieve: (assetId) => sdk.video.assets.retrieve(assetId),
    },
  };
}

export function createMuxOpenFilmIngest(
  config: Readonly<{ tokenId: string; tokenSecret: string }>,
  client: MuxOpenFilmClient = createSdkClient(config.tokenId, config.tokenSecret),
): OpenFilmVideoIngestPort {
  return {
    async createAsset(film: OpenFilm) {
      return mapAsset(
        await client.assets.create({
          inputs: [{ url: film.video.sourceUrl }],
          meta: {
            creator_id: createMovieSlug(film.license.creator).slice(0, 128),
            external_id: film.id,
            title: film.title,
          },
          normalize_audio: false,
          passthrough: `open-film:${film.id}`,
          playback_policies: ["signed"],
          video_quality: film.video.videoQuality,
        }),
      );
    },

    async findAssetByExternalId(externalId: string) {
      let match: OpenFilmProviderAsset | null = null;
      for await (const value of client.assets.list()) {
        const parsed = muxAssetSchema.parse(value);
        if (parsed.meta?.external_id !== externalId) continue;
        if (match !== null) {
          throw new Error(`Multiple Mux assets use open-film external ID ${externalId}`);
        }
        match = mapAsset(parsed);
      }
      return match;
    },

    async getAsset(assetId: string) {
      try {
        return mapAsset(await client.assets.retrieve(assetId));
      } catch (error) {
        if (error instanceof NotFoundError) return null;
        throw error;
      }
    },
  };
}
