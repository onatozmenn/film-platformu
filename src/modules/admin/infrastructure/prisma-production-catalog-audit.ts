import type { PrismaClient } from "@/generated/prisma/client";

import type { ProductionCatalogAuditSnapshot } from "../application/production-catalog-audit";
import { evaluatePublicationReadiness } from "../domain/publication-policy";
import {
  mapPublicationCandidate,
  publicationCandidateSelect,
} from "./prisma-admin-command-support";

export async function readProductionCatalogAuditSnapshot(
  client: PrismaClient,
  now: Date,
  supportedTerritories: readonly string[],
): Promise<ProductionCatalogAuditSnapshot> {
  const [publishedMovies, activeRightsWithoutEvidenceCount] = await Promise.all([
    client.movie.findMany({
      where: { publicationState: "PUBLISHED" },
      select: publicationCandidateSelect,
    }),
    client.contentRight.count({
      where: {
        allowStreaming: true,
        endsAt: { gt: now },
        evidenceReference: null,
        startsAt: { lte: now },
        territory: { in: [...supportedTerritories] },
      },
    }),
  ]);
  const currentlyPlayableMovieCount = publishedMovies.filter(
    (movie) =>
      evaluatePublicationReadiness({
        at: now,
        candidate: mapPublicationCandidate(movie),
        supportedTerritories,
      }).ready,
  ).length;

  return {
    activeRightsWithoutEvidenceCount,
    currentlyPlayableMovieCount,
    publishedMovieCount: publishedMovies.length,
  };
}
