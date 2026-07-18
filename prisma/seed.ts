import "dotenv/config";

import { CollectionState, CreditKind, PublicationState } from "../src/generated/prisma/enums";
import type { PrismaClient } from "../src/generated/prisma/client";
import type {
  CatalogImage,
  HomeRailView,
  MovieDetailView,
} from "../src/modules/catalog/application/catalog-query-port";
import { normalizeCatalogSearchText } from "../src/modules/catalog/domain/catalog-text";
import { fixtureCatalogQuery } from "../src/modules/catalog/infrastructure/fixture-catalog-query";
import { parseServerEnvironment } from "../src/shared/config/server-environment-schema";
import { createDatabaseClient } from "../src/shared/db/client-factory";

const genreIds: Readonly<Record<string, string>> = {
  "bilim-kurgu": "10000000-0000-4000-8000-000000000001",
  dram: "10000000-0000-4000-8000-000000000002",
  gerilim: "10000000-0000-4000-8000-000000000003",
  gizem: "10000000-0000-4000-8000-000000000004",
  komedi: "10000000-0000-4000-8000-000000000005",
  macera: "10000000-0000-4000-8000-000000000006",
};

const imageFallbacks: readonly CatalogImage[] = [
  {
    alt: "Sis altında kayalık Pasifik kıyısı",
    focalPosition: "64% 54%",
    height: 1228,
    src: "/fixtures/catalog/fog-coast.jpg",
    width: 1840,
  },
  {
    alt: "Geceyi tren istasyonunda geçiren yolcular",
    focalPosition: "47% 48%",
    height: 1024,
    src: "/fixtures/catalog/railway-station.jpg",
    width: 789,
  },
  {
    alt: "Gece ışıklarıyla yükselen şehir binaları",
    focalPosition: "50% 45%",
    height: 1024,
    src: "/fixtures/catalog/city-night.jpg",
    width: 701,
  },
  {
    alt: "Perdesi kapalı tarihî tiyatro salonu",
    focalPosition: "53% 52%",
    height: 810,
    src: "/fixtures/catalog/theater-interior.jpg",
    width: 1024,
  },
];

const collectionDefinitions = [
  {
    id: "30000000-0000-4000-8000-000000000001",
    railId: "home-featured",
    slug: "ana-sayfa-one-cikan",
    title: "Ana sayfa öne çıkan",
  },
  {
    id: "30000000-0000-4000-8000-000000000002",
    railId: "editorial",
    slug: "editorun-seckisi",
    title: "Editörün seçkisi",
  },
  {
    id: "30000000-0000-4000-8000-000000000003",
    railId: "new",
    slug: "yeni-eklenenler",
    title: "Yeni eklenenler",
  },
  {
    id: "30000000-0000-4000-8000-000000000004",
    railId: "popular",
    slug: "ilk-on",
    title: "İlk on",
  },
] as const;

function imageColumns(prefix: "backdrop" | "poster", image: CatalogImage) {
  return {
    [`${prefix}Alt`]: image.alt,
    [`${prefix}FocalPosition`]: image.focalPosition,
    [`${prefix}Height`]: image.height,
    [`${prefix}Src`]: image.src,
    [`${prefix}Width`]: image.width,
  };
}

function creditKind(label: string): CreditKind {
  switch (label) {
    case "Yönetmen":
      return CreditKind.DIRECTOR;
    case "Senaryo":
      return CreditKind.WRITER;
    case "Oyuncular":
      return CreditKind.CAST;
    default:
      return CreditKind.OTHER;
  }
}

function deterministicUuid(prefix: string, index: number): string {
  return `${prefix}-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

async function resetCatalog(client: PrismaClient): Promise<void> {
  await client.$transaction([
    client.processedWebhook.deleteMany(),
    client.metadataSource.deleteMany(),
    client.collectionMovie.deleteMany(),
    client.collection.deleteMany(),
    client.credit.deleteMany(),
    client.person.deleteMany(),
    client.movieGenre.deleteMany(),
    client.genre.deleteMany(),
    client.movie.deleteMany(),
  ]);
}

async function seedCatalog(client: PrismaClient): Promise<void> {
  const home = await fixtureCatalogQuery.getHomePage();
  const catalog = await fixtureCatalogQuery.listMovies({
    genre: null,
    page: 1,
    sort: "editor-secimi",
    year: null,
  });
  const details = new Map<string, MovieDetailView>();

  for (const movie of catalog.movies) {
    const detail = await fixtureCatalogQuery.getMovieBySlug(movie.slug);
    if (detail === null) {
      throw new Error(`Missing fixture detail for ${movie.slug}`);
    }
    details.set(movie.slug, detail);
  }

  await resetCatalog(client);
  await client.genre.createMany({
    data: catalog.availableGenres.map((genre) => {
      const id = genreIds[genre.slug];
      if (id === undefined) {
        throw new Error(`Missing deterministic genre ID for ${genre.slug}`);
      }
      return { id, name: genre.name, slug: genre.slug };
    }),
  });

  const newRail = home.rails.find((rail) => rail.id === "new");
  const addedPositions = new Map(
    (newRail?.movies ?? []).map((movie, index) => [movie.id, index] as const),
  );

  for (const [index, card] of catalog.movies.entries()) {
    const detail = details.get(card.slug);
    if (detail === undefined) {
      throw new Error(`Missing normalized detail for ${card.slug}`);
    }
    const poster = detail.poster ?? imageFallbacks[index % imageFallbacks.length];
    const backdrop = detail.backdrop ?? imageFallbacks[(index + 1) % imageFallbacks.length];
    if (poster === undefined || backdrop === undefined) {
      throw new Error("Missing deterministic image fallback");
    }
    const addedPosition = addedPositions.get(card.id) ?? index;

    await client.movie.create({
      data: {
        id: card.id,
        addedAt: new Date(Date.UTC(2026, 6, 1 - addedPosition)),
        ageRating: detail.ageRating,
        originalTitle: detail.originalTitle,
        originalTitleSearch:
          detail.originalTitle === null ? null : normalizeCatalogSearchText(detail.originalTitle),
        publicationState: PublicationState.PUBLISHED,
        releaseDate: new Date(Date.UTC(card.year, 0, 1)),
        runtimeMinutes: detail.runtimeMinutes,
        slug: card.slug,
        synopsis: detail.synopsis,
        title: card.title,
        titleSearch: normalizeCatalogSearchText(card.title),
        ...imageColumns("poster", poster),
        ...imageColumns("backdrop", backdrop),
        genres: {
          create: detail.genres.map((genreName) => {
            const option = catalog.availableGenres.find((genre) => genre.name === genreName);
            if (option === undefined) {
              throw new Error(`Missing genre option for ${genreName}`);
            }
            const genreId = genreIds[option.slug];
            if (genreId === undefined) {
              throw new Error(`Missing deterministic genre ID for ${option.slug}`);
            }
            return { genreId };
          }),
        },
      },
    });
  }

  const people = [
    ...new Set(
      [...details.values()].flatMap((detail) => detail.credits.flatMap((group) => group.names)),
    ),
  ].sort((left, right) => left.localeCompare(right, "tr-TR"));
  const personFixtures = people.map((name, index) => ({
    id: deterministicUuid("20000000", index + 1),
    name,
  }));
  const personIds = new Map(personFixtures.map((person) => [person.name, person.id] as const));
  await client.person.createMany({
    data: personFixtures.map((person) => ({
      id: person.id,
      name: person.name,
      nameSearch: normalizeCatalogSearchText(person.name),
    })),
  });

  let creditIndex = 1;
  for (const detail of details.values()) {
    for (const group of detail.credits) {
      for (const [billingOrder, name] of group.names.entries()) {
        const personId = personIds.get(name);
        if (personId === undefined) {
          throw new Error(`Missing person fixture for ${name}`);
        }
        await client.credit.create({
          data: {
            id: deterministicUuid("21000000", creditIndex),
            billingOrder,
            kind: creditKind(group.label),
            movieId: detail.id,
            personId,
          },
        });
        creditIndex += 1;
      }
    }
  }

  const railsById = new Map(home.rails.map((rail) => [rail.id, rail] as const));
  for (const [displayOrder, definition] of collectionDefinitions.entries()) {
    const rail: HomeRailView =
      definition.railId === "home-featured"
        ? {
            id: "home-featured",
            movies: [home.featured],
            title: definition.title,
            variant: "standard",
            viewAllHref: null,
          }
        : (railsById.get(definition.railId) ?? {
            id: definition.railId,
            movies: [],
            title: definition.title,
            variant: "standard",
            viewAllHref: null,
          });

    await client.collection.create({
      data: {
        id: definition.id,
        displayOrder,
        slug: definition.slug,
        state: CollectionState.PUBLISHED,
        title: definition.title,
        movies: {
          create: rail.movies.map((movie, position) => ({ movieId: movie.id, position })),
        },
      },
    });
  }

  await client.collection.create({
    data: {
      id: "30000000-0000-4000-8000-000000000005",
      displayOrder: 99,
      slug: "bos-secki",
      state: CollectionState.PUBLISHED,
      title: "Boş seçki",
    },
  });

  const hiddenMovies = [
    {
      id: "00000000-0000-4000-8000-000000000101",
      publicationState: PublicationState.DRAFT,
      publishAt: null,
      slug: "kurgu-masasinda",
      title: "Kurgu Masasında",
    },
    {
      id: "00000000-0000-4000-8000-000000000102",
      publicationState: PublicationState.SCHEDULED,
      publishAt: new Date("2035-01-01T00:00:00.000Z"),
      slug: "gelecek-program",
      title: "Gelecek Program",
    },
    {
      id: "00000000-0000-4000-8000-000000000103",
      publicationState: PublicationState.PUBLISHED,
      publishAt: new Date("2035-01-01T00:00:00.000Z"),
      slug: "erken-yayin",
      title: "Erken Yayın",
    },
    {
      id: "00000000-0000-4000-8000-000000000104",
      publicationState: PublicationState.UNPUBLISHED,
      publishAt: null,
      slug: "programdan-kaldirilan",
      title: "Programdan Kaldırılan",
    },
  ] as const;

  await client.movie.createMany({
    data: hiddenMovies.map((movie) => ({
      ...movie,
      addedAt: new Date("2026-01-01T00:00:00.000Z"),
      releaseDate: new Date("2026-01-01T00:00:00.000Z"),
      runtimeMinutes: 90,
      synopsis: "Bu kayıt yalnızca yayın görünürlüğü politikasını doğrulayan kurgusal bir filmdir.",
      titleSearch: normalizeCatalogSearchText(movie.title),
    })),
  });

  await client.videoAsset.create({
    data: {
      id: "40000000-0000-4000-8000-000000000001",
      durationSeconds: 5_880,
      height: 360,
      isActive: true,
      movieId: "00000000-0000-4000-8000-000000000001",
      provider: "MUX",
      providerAssetId: "fake-asset-kiyidaki-sessizlik",
      providerPlaybackId: "fake-playback-kiyidaki-sessizlik",
      state: "READY",
      width: 640,
      subtitleTracks: {
        create: [
          {
            id: "42000000-0000-4000-8000-000000000001",
            isDefault: true,
            kind: "SUBTITLES",
            label: "Türkçe",
            languageTag: "tr",
            providerTrackId: "fake-track-tr",
          },
          {
            id: "42000000-0000-4000-8000-000000000002",
            kind: "SUBTITLES",
            label: "English",
            languageTag: "en",
            providerTrackId: "fake-track-en",
          },
        ],
      },
    },
  });
  await client.contentRight.create({
    data: {
      allowStreaming: true,
      endsAt: new Date("2035-01-01T00:00:00.000Z"),
      id: "41000000-0000-4000-8000-000000000001",
      movieId: "00000000-0000-4000-8000-000000000001",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      territory: "TR",
    },
  });

  await client.videoAsset.create({
    data: {
      id: "40000000-0000-4000-8000-000000000002",
      durationSeconds: 5_520,
      isActive: true,
      movieId: "00000000-0000-4000-8000-000000000006",
      provider: "MUX",
      providerAssetId: "fake-asset-expired-rights",
      providerPlaybackId: "fake-playback-expired-rights",
      state: "READY",
    },
  });
  await client.contentRight.create({
    data: {
      allowStreaming: true,
      endsAt: new Date("2021-01-01T00:00:00.000Z"),
      id: "41000000-0000-4000-8000-000000000002",
      movieId: "00000000-0000-4000-8000-000000000006",
      startsAt: new Date("2020-01-01T00:00:00.000Z"),
      territory: "TR",
    },
  });

  await client.videoAsset.create({
    data: {
      id: "40000000-0000-4000-8000-000000000003",
      durationSeconds: 6_660,
      isActive: true,
      movieId: "00000000-0000-4000-8000-000000000002",
      provider: "MUX",
      providerAssetId: "fake-asset-provider-error",
      providerPlaybackId: "fake-playback-provider-error",
      state: "READY",
    },
  });
  await client.contentRight.create({
    data: {
      allowStreaming: true,
      endsAt: new Date("2035-01-01T00:00:00.000Z"),
      id: "41000000-0000-4000-8000-000000000003",
      movieId: "00000000-0000-4000-8000-000000000002",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      territory: "TR",
    },
  });

  await client.videoAsset.create({
    data: {
      id: "40000000-0000-4000-8000-000000000004",
      isActive: false,
      movieId: "00000000-0000-4000-8000-000000000101",
      provider: "MUX",
      providerAssetId: "fake-asset-draft-preparing",
      state: "PREPARING",
    },
  });
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Deterministic fixture seeding is disabled in production");
  }
  const environment = parseServerEnvironment({
    DATABASE_URL: process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL,
    LOCAL_DEFAULT_TERRITORY: process.env.LOCAL_DEFAULT_TERRITORY,
    LOG_LEVEL: process.env.LOG_LEVEL,
    MUX_SIGNING_KEY_ID: process.env.MUX_SIGNING_KEY_ID,
    MUX_SIGNING_PRIVATE_KEY: process.env.MUX_SIGNING_PRIVATE_KEY,
    MUX_TOKEN_ID: process.env.MUX_TOKEN_ID,
    MUX_TOKEN_SECRET: process.env.MUX_TOKEN_SECRET,
    MUX_WEBHOOK_SECRET: process.env.MUX_WEBHOOK_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    SITE_ORIGIN: process.env.SITE_ORIGIN,
    SUPPORTED_TERRITORIES: process.env.SUPPORTED_TERRITORIES,
    TMDB_API_TOKEN: process.env.TMDB_API_TOKEN,
    TMDB_ENABLED: process.env.TMDB_ENABLED,
    TRUST_INCOMING_REQUEST_ID: process.env.TRUST_INCOMING_REQUEST_ID,
    VIDEO_PROVIDER: process.env.VIDEO_PROVIDER,
  });
  const client = createDatabaseClient(environment.databaseUrl);

  try {
    await seedCatalog(client);
    process.stdout.write("Deterministic catalog fixtures seeded.\n");
  } finally {
    await client.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown seed failure";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
