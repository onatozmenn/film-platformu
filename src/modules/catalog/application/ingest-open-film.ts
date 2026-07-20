import type { OpenFilm } from "./open-film-manifest";

export type OpenFilmProviderAsset = Readonly<{
  durationSeconds: number | null;
  id: string;
  playbackId: string | null;
  state: "ERRORED" | "PREPARING" | "READY";
}>;

export interface OpenFilmVideoIngestPort {
  createAsset(film: OpenFilm): Promise<OpenFilmProviderAsset>;
  findAssetByExternalId(externalId: string): Promise<OpenFilmProviderAsset | null>;
  getAsset(assetId: string): Promise<OpenFilmProviderAsset | null>;
}

export interface OpenFilmCatalogIngestPort {
  findProviderAssetId(movieId: string): Promise<string | null>;
  sync(
    input: Readonly<{ asset: OpenFilmProviderAsset; film: OpenFilm; observedAt: Date }>,
  ): Promise<void>;
}

export type OpenFilmIngestResult = Readonly<{
  assetOrigin: "created" | "recovered" | "reused";
  assetState: OpenFilmProviderAsset["state"];
  slug: string;
}>;

export async function ingestOpenFilm(
  film: OpenFilm,
  dependencies: Readonly<{
    clock: () => Date;
    delay: () => Promise<void>;
    maximumReadyChecks: number;
    repository: OpenFilmCatalogIngestPort;
    video: OpenFilmVideoIngestPort;
  }>,
): Promise<OpenFilmIngestResult> {
  const boundAssetId = await dependencies.repository.findProviderAssetId(film.id);
  let asset: OpenFilmProviderAsset | null;
  let assetOrigin: OpenFilmIngestResult["assetOrigin"];

  if (boundAssetId !== null) {
    asset = await dependencies.video.getAsset(boundAssetId);
    assetOrigin = "reused";
    if (asset === null) {
      throw new Error(`Bound Mux asset is missing for ${film.slug}`);
    }
  } else {
    asset = await dependencies.video.findAssetByExternalId(film.id);
    if (asset === null) {
      asset = await dependencies.video.createAsset(film);
      assetOrigin = "created";
    } else {
      assetOrigin = "recovered";
    }
  }

  await dependencies.repository.sync({ asset, film, observedAt: dependencies.clock() });
  for (
    let check = 0;
    asset.state === "PREPARING" && check < dependencies.maximumReadyChecks;
    check += 1
  ) {
    await dependencies.delay();
    const refreshed = await dependencies.video.getAsset(asset.id);
    if (refreshed === null) {
      throw new Error(`Mux asset disappeared while preparing ${film.slug}`);
    }
    asset = refreshed;
    await dependencies.repository.sync({ asset, film, observedAt: dependencies.clock() });
  }

  if (asset.state === "PREPARING") {
    throw new Error(`Mux asset did not become ready for ${film.slug}`);
  }
  if (asset.state === "ERRORED") {
    throw new Error(`Mux asset processing failed for ${film.slug}`);
  }
  if (asset.playbackId === null || asset.durationSeconds === null) {
    throw new Error(`Ready Mux asset is incomplete for ${film.slug}`);
  }

  return { assetOrigin, assetState: asset.state, slug: film.slug };
}
