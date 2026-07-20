import "dotenv/config";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import openFilmCatalog from "@/content/open-film-catalog.json";
import { ingestOpenFilm } from "@/modules/catalog/application/ingest-open-film";
import {
  parseOpenFilmManifest,
  type OpenFilm,
} from "@/modules/catalog/application/open-film-manifest";
import { createPrismaOpenFilmIngest } from "@/modules/catalog/infrastructure/prisma-open-film-ingest";
import { createMuxOpenFilmIngest } from "@/modules/playback/infrastructure/mux-open-film-ingest";
import { parseServerEnvironment } from "@/shared/config/server-environment-schema";
import { createDatabaseClient } from "@/shared/db/client-factory";

function parseArguments(arguments_: readonly string[]): Readonly<{ apply: boolean }> {
  const unknown = arguments_.filter(
    (argument) => argument !== "--apply" && argument !== "--dry-run",
  );
  if (unknown.length > 0) {
    throw new Error(`Unsupported arguments: ${unknown.join(", ")}`);
  }
  if (arguments_.includes("--apply") && arguments_.includes("--dry-run")) {
    throw new Error("Use either --apply or --dry-run, not both");
  }
  return { apply: arguments_.includes("--apply") };
}

async function verifyArtwork(film: OpenFilm): Promise<void> {
  const uniqueArtwork = new Map(
    [film.artwork.poster, film.artwork.backdrop].map((artwork) => [artwork.src, artwork] as const),
  );
  for (const artwork of uniqueArtwork.values()) {
    const filePath = path.join(process.cwd(), "public", ...artwork.src.slice(1).split("/"));
    const contents = await readFile(filePath);
    const digest = createHash("sha256").update(contents).digest("hex");
    if (digest.toLowerCase() !== artwork.sha256.toLowerCase()) {
      throw new Error(`Artwork integrity check failed for ${film.slug}`);
    }
  }
}

async function verifyVideoSource(film: OpenFilm): Promise<Readonly<{ bytes: number }>> {
  const response = await fetch(film.video.sourceUrl, {
    method: "HEAD",
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  const contentLength = Number(response.headers.get("content-length"));
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (
    !response.ok ||
    !Number.isSafeInteger(contentLength) ||
    contentLength < 1 ||
    contentLength > 20 * 1_024 * 1_024 * 1_024 ||
    (!contentType.startsWith("video/") && contentType !== "application/octet-stream")
  ) {
    throw new Error(`Video source preflight failed for ${film.slug}`);
  }
  return { bytes: contentLength };
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  const manifest = parseOpenFilmManifest(openFilmCatalog);
  const sourceBytes = new Map<string, number>();
  for (const film of manifest.films) {
    await verifyArtwork(film);
    sourceBytes.set(film.slug, (await verifyVideoSource(film)).bytes);
  }

  if (options.apply) {
    const environment = parseServerEnvironment({
      DATABASE_URL: process.env.DATABASE_URL,
      LOCAL_DEFAULT_TERRITORY: process.env.LOCAL_DEFAULT_TERRITORY,
      LOG_LEVEL: process.env.LOG_LEVEL,
      MUX_SIGNING_KEY_ID: process.env.MUX_SIGNING_KEY_ID,
      MUX_SIGNING_PRIVATE_KEY: process.env.MUX_SIGNING_PRIVATE_KEY,
      MUX_TOKEN_ID: process.env.MUX_TOKEN_ID,
      MUX_TOKEN_SECRET: process.env.MUX_TOKEN_SECRET,
      MUX_WEBHOOK_SECRET: process.env.MUX_WEBHOOK_SECRET,
      NODE_ENV: process.env.NODE_ENV,
      RELEASE_ID: process.env.RELEASE_ID,
      SITE_ORIGIN: process.env.SITE_ORIGIN,
      SUPPORTED_TERRITORIES: process.env.SUPPORTED_TERRITORIES,
      TMDB_API_TOKEN: process.env.TMDB_API_TOKEN,
      TMDB_ENABLED: process.env.TMDB_ENABLED,
      TRUST_INCOMING_REQUEST_ID: process.env.TRUST_INCOMING_REQUEST_ID,
      VIDEO_PROVIDER: process.env.VIDEO_PROVIDER,
    });
    if (environment.playback.videoProvider.kind !== "mux") {
      throw new Error("VIDEO_PROVIDER must be mux for open film ingest");
    }

    const client = createDatabaseClient(environment.databaseUrl);
    try {
      const repository = createPrismaOpenFilmIngest(
        client,
        environment.playback.supportedTerritories,
      );
      const video = createMuxOpenFilmIngest({
        tokenId: environment.playback.videoProvider.tokenId,
        tokenSecret: environment.playback.videoProvider.tokenSecret,
      });
      const results = [];
      for (const film of manifest.films) {
        results.push(
          await ingestOpenFilm(film, {
            clock: () => new Date(),
            delay: () => delay(5_000),
            maximumReadyChecks: 180,
            repository,
            video,
          }),
        );
      }
      process.stdout.write(
        `${JSON.stringify({ applied: true, results, valid: true, version: manifest.version }, null, 2)}\n`,
      );
    } finally {
      await client.$disconnect();
    }
    return;
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        applied: false,
        films: manifest.films.map((film) => ({
          bytes: sourceBytes.get(film.slug),
          license: film.license.id,
          slug: film.slug,
          territories: film.rights.territories,
        })),
        valid: true,
        version: manifest.version,
      },
      null,
      2,
    )}\n`,
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Open film dry-run failed";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
