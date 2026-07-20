import { createHash } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  AuditActorType,
  CreditKind,
  PublicationState,
  VideoAssetState,
  VideoProvider,
} from "@/generated/prisma/enums";
import type {
  OpenFilmCatalogIngestPort,
  OpenFilmProviderAsset,
} from "@/modules/catalog/application/ingest-open-film";
import type { OpenFilm } from "@/modules/catalog/application/open-film-manifest";
import { normalizeCatalogSearchText } from "@/modules/catalog/domain/catalog-text";
import { evaluatePublicationReadiness } from "@/modules/admin/domain/publication-policy";

const transactionOptions = { maxWait: 2_000, timeout: 5_000 } as const;

function artworkColumns(prefix: "backdrop" | "poster", artwork: OpenFilm["artwork"]["poster"]) {
  return {
    [`${prefix}Alt`]: artwork.alt,
    [`${prefix}FocalPosition`]: artwork.focalPosition,
    [`${prefix}Height`]: artwork.height,
    [`${prefix}Src`]: artwork.src,
    [`${prefix}Width`]: artwork.width,
  };
}

function auditRequestId(film: OpenFilm, asset: OpenFilmProviderAsset): string {
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ asset, film }))
    .digest("hex")
    .slice(0, 48);
  return `open-film-${fingerprint}`;
}

export function createPrismaOpenFilmIngest(
  client: PrismaClient,
  supportedTerritories: readonly string[],
): OpenFilmCatalogIngestPort {
  return {
    async findProviderAssetId(movieId) {
      const asset = await client.videoAsset.findFirst({
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        select: { providerAssetId: true },
        where: { movieId, provider: VideoProvider.MUX },
      });
      return asset?.providerAssetId ?? null;
    },

    async sync({ asset, film, observedAt }) {
      if (film.rights.territories.some((territory) => !supportedTerritories.includes(territory))) {
        throw new Error(`Open film contains an unsupported territory: ${film.slug}`);
      }

      await client.$transaction(async (transaction) => {
        const identity = await transaction.movie.findFirst({
          select: { firstPublishedAt: true, id: true, publicationState: true, slug: true },
          where: { OR: [{ id: film.id }, { slug: film.slug }] },
        });
        if (identity !== null && (identity.id !== film.id || identity.slug !== film.slug)) {
          throw new Error(`Open film identity conflicts with the catalog: ${film.slug}`);
        }

        await transaction.movie.upsert({
          create: {
            ...artworkColumns("backdrop", film.artwork.backdrop),
            ...artworkColumns("poster", film.artwork.poster),
            addedAt: observedAt,
            ageRating: film.ageRating,
            id: film.id,
            originalTitle: film.originalTitle,
            originalTitleSearch:
              film.originalTitle === null ? null : normalizeCatalogSearchText(film.originalTitle),
            publicationState: PublicationState.DRAFT,
            releaseDate: new Date(`${film.releaseDate}T00:00:00.000Z`),
            runtimeMinutes: film.runtimeMinutes,
            slug: film.slug,
            synopsis: film.synopsis,
            title: film.title,
            titleSearch: normalizeCatalogSearchText(film.title),
          },
          update: {
            ...artworkColumns("backdrop", film.artwork.backdrop),
            ...artworkColumns("poster", film.artwork.poster),
            ageRating: film.ageRating,
            originalTitle: film.originalTitle,
            originalTitleSearch:
              film.originalTitle === null ? null : normalizeCatalogSearchText(film.originalTitle),
            releaseDate: new Date(`${film.releaseDate}T00:00:00.000Z`),
            runtimeMinutes: film.runtimeMinutes,
            synopsis: film.synopsis,
            title: film.title,
            titleSearch: normalizeCatalogSearchText(film.title),
          },
          where: { id: film.id },
        });

        const genreIds: string[] = [];
        for (const genre of film.genres) {
          const stored = await transaction.genre.upsert({
            create: genre,
            update: { name: genre.name },
            where: { slug: genre.slug },
          });
          genreIds.push(stored.id);
        }
        await transaction.movieGenre.deleteMany({ where: { movieId: film.id } });
        await transaction.movieGenre.createMany({
          data: genreIds.map((genreId) => ({ genreId, movieId: film.id })),
        });

        const newCollection = await transaction.collection.findUnique({
          select: { id: true },
          where: { slug: "yeni-eklenenler" },
        });
        if (newCollection !== null) {
          const currentMembership = await transaction.collectionMovie.findUnique({
            where: {
              collectionId_movieId: { collectionId: newCollection.id, movieId: film.id },
            },
          });
          if (currentMembership === null) {
            const lastPosition = await transaction.collectionMovie.findFirst({
              orderBy: { position: "desc" },
              select: { position: true },
              where: { collectionId: newCollection.id },
            });
            await transaction.collectionMovie.create({
              data: {
                collectionId: newCollection.id,
                movieId: film.id,
                position: (lastPosition?.position ?? -1) + 1,
              },
            });
          }
        }

        await transaction.credit.deleteMany({ where: { movieId: film.id } });
        for (const credit of film.credits) {
          const nameSearch = normalizeCatalogSearchText(credit.name);
          const existingPerson = await transaction.person.findFirst({
            where: { name: credit.name, nameSearch, provider: null },
          });
          const person =
            existingPerson ??
            (await transaction.person.create({ data: { name: credit.name, nameSearch } }));
          await transaction.credit.create({
            data: {
              billingOrder: credit.billingOrder,
              displayLabel: credit.displayLabel,
              kind: CreditKind[credit.kind],
              movieId: film.id,
              personId: person.id,
            },
          });
        }

        for (const territory of film.rights.territories) {
          const current = await transaction.contentRight.findFirst({
            orderBy: { updatedAt: "desc" },
            where: { allowStreaming: true, movieId: film.id, territory },
          });
          const data = {
            allowStreaming: true,
            endsAt: new Date(film.rights.endsAt),
            evidenceReference: film.license.evidenceReference,
            startsAt: new Date(film.rights.startsAt),
            territory,
          } as const;
          if (current === null) {
            await transaction.contentRight.create({ data: { ...data, movieId: film.id } });
          } else {
            await transaction.contentRight.update({ data, where: { id: current.id } });
          }
        }

        const existingAsset = await transaction.videoAsset.findUnique({
          where: {
            provider_providerAssetId: {
              provider: VideoProvider.MUX,
              providerAssetId: asset.id,
            },
          },
        });
        if (existingAsset !== null && existingAsset.movieId !== film.id) {
          throw new Error(`Mux asset is already attached to another film: ${film.slug}`);
        }
        if (asset.state === "READY") {
          await transaction.videoAsset.updateMany({
            data: { isActive: false },
            where: { isActive: true, movieId: film.id },
          });
        }
        await transaction.videoAsset.upsert({
          create: {
            durationSeconds: asset.durationSeconds,
            isActive: asset.state === "READY",
            movieId: film.id,
            provider: VideoProvider.MUX,
            providerAssetId: asset.id,
            providerPlaybackId: asset.playbackId,
            state: VideoAssetState[asset.state],
          },
          update: {
            durationSeconds: asset.durationSeconds,
            isActive: asset.state === "READY",
            providerPlaybackId: asset.playbackId,
            state: VideoAssetState[asset.state],
          },
          where: {
            provider_providerAssetId: {
              provider: VideoProvider.MUX,
              providerAssetId: asset.id,
            },
          },
        });

        const [rights, assets] = await Promise.all([
          transaction.contentRight.findMany({ where: { movieId: film.id } }),
          transaction.videoAsset.findMany({ where: { movieId: film.id } }),
        ]);
        const publication = evaluatePublicationReadiness({
          at: observedAt,
          candidate: {
            assets: assets.map((stored) => ({
              durationSeconds: stored.durationSeconds,
              isActive: stored.isActive,
              providerPlaybackId: stored.providerPlaybackId,
              state: stored.state,
            })),
            backdrop: { ...film.artwork.backdrop, referenceValidated: true },
            genreIds,
            poster: { ...film.artwork.poster, referenceValidated: true },
            releaseDate: new Date(`${film.releaseDate}T00:00:00.000Z`),
            rights: rights.map((right) => ({
              allowStreaming: right.allowStreaming,
              endsAt: right.endsAt,
              evidenceReference: right.evidenceReference,
              startsAt: right.startsAt,
              territory: right.territory,
            })),
            runtimeMinutes: film.runtimeMinutes,
            synopsis: film.synopsis,
            title: film.title,
          },
          supportedTerritories,
        });
        if (asset.state === "READY" && !publication.ready) {
          throw new Error(`Open film is not publication-ready: ${publication.issues.join(",")}`);
        }
        if (publication.ready) {
          await transaction.movie.update({
            data: {
              firstPublishedAt: identity?.firstPublishedAt ?? observedAt,
              lastPublishAttemptAt: null,
              lastPublishFailure: null,
              publicationState: PublicationState.PUBLISHED,
              publishAt: null,
            },
            where: { id: film.id },
          });
        }

        const requestId = auditRequestId(film, asset);
        const existingAudit = await transaction.auditEvent.findFirst({
          where: { action: "OPEN_FILM_SYNCED", requestId, targetId: film.id },
        });
        if (existingAudit === null) {
          await transaction.auditEvent.create({
            data: {
              action: "OPEN_FILM_SYNCED",
              actorType: AuditActorType.SYSTEM,
              metadata: {
                assetState: asset.state,
                license: film.license.id,
                published: publication.ready,
                territories: film.rights.territories,
              },
              requestId,
              targetId: film.id,
              targetType: "MOVIE",
            },
          });
        }
      }, transactionOptions);
    },
  };
}
