import type { PrismaClient } from "@/generated/prisma/client";

import type { CatalogVisibilityPort } from "../application/catalog-visibility-port";

export function createPrismaCatalogVisibility(client: PrismaClient): CatalogVisibilityPort {
  return {
    async isVisibleMovie(movieId, now) {
      const movie = await client.movie.findFirst({
        where: {
          id: movieId,
          publicationState: "PUBLISHED",
          OR: [{ publishAt: null }, { publishAt: { lte: now } }],
        },
        select: { id: true },
      });
      return movie !== null;
    },
  };
}
