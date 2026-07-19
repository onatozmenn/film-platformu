import "server-only";

import { catalogInvalidation, metadataProvider } from "@/modules/catalog/server";
import { videoProvider } from "@/modules/playback/server";
import { getInternalJobsEnvironment } from "@/shared/config/internal-jobs-server";
import { getServerEnvironment } from "@/shared/config/server-environment";
import { database } from "@/shared/db/database";
import { createFixedWindowRateLimiter } from "@/shared/http/fixed-window-rate-limiter";
import { logger } from "@/shared/observability/logger";

import { createAdminCommandService } from "./application/create-admin-command-service";
import { createPrismaAdminCommandRepository } from "./infrastructure/prisma-admin-command-repository";
import { createPrismaAdminQuery } from "./infrastructure/prisma-admin-query";

const environment = getServerEnvironment();
const clock = () => new Date();
const repository = createPrismaAdminCommandRepository(database, {
  clock,
  supportedTerritories: environment.playback.supportedTerritories,
});

function publicationBatchLimit(): number {
  const jobs = getInternalJobsEnvironment();
  return jobs.kind === "enabled" ? jobs.publicationBatchLimit : 25;
}

export const adminCommandService = createAdminCommandService({
  catalogInvalidation,
  clock,
  metadataProvider,
  publicationBatchLimit: publicationBatchLimit(),
  reportInvalidationFailure: () => logger.warn("admin.catalog_invalidation_failed"),
  repository,
  videoProvider,
});

export const adminQueries = createPrismaAdminQuery(database);
export const adminMutationRateLimiter = createFixedWindowRateLimiter(
  environment.nodeEnvironment === "production" ? 30 : 500,
  60_000,
);

const adminBrowserFixture = {
  id: "00000000-0000-4000-8000-000000000101",
  slug: "kurgu-masasinda",
} as const;

export async function resetAdminBrowserFixture(): Promise<void> {
  if (environment.nodeEnvironment === "production") {
    throw new Error("Admin browser fixture reset is disabled in production");
  }
  await database.$transaction(async (transaction) => {
    await transaction.$executeRaw`TRUNCATE TABLE "audit_events"`;
    await transaction.videoAsset.deleteMany({ where: { movieId: adminBrowserFixture.id } });
    await transaction.contentRight.deleteMany({ where: { movieId: adminBrowserFixture.id } });
    await transaction.credit.deleteMany({ where: { movieId: adminBrowserFixture.id } });
    await transaction.movieGenre.deleteMany({ where: { movieId: adminBrowserFixture.id } });
    await transaction.movie.update({
      where: { id: adminBrowserFixture.id },
      data: {
        ageRating: null,
        backdropAlt: null,
        backdropFocalPosition: null,
        backdropHeight: null,
        backdropSrc: null,
        backdropWidth: null,
        firstPublishedAt: null,
        lastPublishAttemptAt: null,
        lastPublishFailure: null,
        originalTitle: null,
        originalTitleSearch: null,
        posterAlt: null,
        posterFocalPosition: null,
        posterHeight: null,
        posterSrc: null,
        posterWidth: null,
        publicationState: "DRAFT",
        publishAt: null,
        releaseDate: new Date("2026-01-01T00:00:00.000Z"),
        revision: 1,
        runtimeMinutes: 90,
        slug: adminBrowserFixture.slug,
        synopsis:
          "Bu kayıt yalnızca yayın görünürlüğü politikasını doğrulayan kurgusal bir filmdir.",
        title: "Kurgu Masasında",
        titleSearch: "kurgu masasinda",
      },
    });
  });
  catalogInvalidation.invalidate({
    expireImmediately: true,
    movieIds: [adminBrowserFixture.id],
    movieSlugs: [adminBrowserFixture.slug],
    searchChanged: true,
  });
}
