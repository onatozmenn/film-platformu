import type { PrismaClient } from "@/generated/prisma/client";

import type { PlaybackCandidate, PlaybackRepositoryPort } from "../application/playback-ports";

export function createPrismaPlaybackRepository(client: PrismaClient): PlaybackRepositoryPort {
  return {
    async findCandidateByMovieId(movieId: string): Promise<PlaybackCandidate | null> {
      const movie = await client.movie.findUnique({
        where: { id: movieId },
        include: {
          contentRights: true,
          videoAssets: true,
        },
      });

      if (movie === null) {
        return null;
      }

      return {
        assets: movie.videoAssets.map((asset) => ({
          durationSeconds: asset.durationSeconds,
          id: asset.id,
          isActive: asset.isActive,
          providerAssetId: asset.providerAssetId,
          providerPlaybackId: asset.providerPlaybackId,
          state: asset.state,
        })),
        id: movie.id,
        publicationState: movie.publicationState,
        publishAt: movie.publishAt,
        rights: movie.contentRights.map((right) => ({
          allowStreaming: right.allowStreaming,
          endsAt: right.endsAt,
          id: right.id,
          startsAt: right.startsAt,
          territory: right.territory,
        })),
        title: movie.title,
      };
    },
  };
}
