import { describe, expect, it, vi } from "vitest";

import openFilmCatalog from "@/content/open-film-catalog.json";

import {
  ingestOpenFilm,
  type OpenFilmCatalogIngestPort,
  type OpenFilmProviderAsset,
  type OpenFilmVideoIngestPort,
} from "./ingest-open-film";
import { parseOpenFilmManifest } from "./open-film-manifest";

function firstValue<T>(values: readonly T[]): T {
  const value = values[0];
  if (value === undefined) throw new Error("Missing fixture value");
  return value;
}

const film = firstValue(parseOpenFilmManifest(openFilmCatalog).films);

const readyAsset: OpenFilmProviderAsset = {
  durationSeconds: 596,
  id: "mux-asset-ready",
  playbackId: "mux-playback-signed",
  state: "READY",
};
const preparingAsset: OpenFilmProviderAsset = {
  durationSeconds: null,
  id: "mux-asset-ready",
  playbackId: "mux-playback-signed",
  state: "PREPARING",
};

function ports(boundAssetId: string | null = null) {
  const repository = {
    findProviderAssetId: vi.fn<OpenFilmCatalogIngestPort["findProviderAssetId"]>(
      async () => boundAssetId,
    ),
    sync: vi.fn<OpenFilmCatalogIngestPort["sync"]>(async () => undefined),
  } satisfies OpenFilmCatalogIngestPort;
  const video = {
    createAsset: vi.fn<OpenFilmVideoIngestPort["createAsset"]>(async () => readyAsset),
    findAssetByExternalId: vi.fn<OpenFilmVideoIngestPort["findAssetByExternalId"]>(
      async () => null,
    ),
    getAsset: vi.fn<OpenFilmVideoIngestPort["getAsset"]>(async () => readyAsset),
  } satisfies OpenFilmVideoIngestPort;
  const delay = vi.fn(async () => undefined);
  return { delay, repository, video };
}

function run(input: ReturnType<typeof ports>) {
  return ingestOpenFilm(film, {
    clock: () => new Date("2026-07-20T12:00:00.000Z"),
    delay: input.delay,
    maximumReadyChecks: 2,
    repository: input.repository,
    video: input.video,
  });
}

describe("ingest open film", () => {
  it("reuses an asset already bound in the catalog", async () => {
    const input = ports("mux-asset-ready");

    await expect(run(input)).resolves.toEqual({
      assetOrigin: "reused",
      assetState: "READY",
      slug: "big-buck-bunny",
    });
    expect(input.video.getAsset).toHaveBeenCalledWith("mux-asset-ready");
    expect(input.video.findAssetByExternalId).not.toHaveBeenCalled();
    expect(input.video.createAsset).not.toHaveBeenCalled();
    expect(input.repository.sync).toHaveBeenCalledOnce();
  });

  it("recovers an unbound provider asset by stable external ID", async () => {
    const input = ports();
    input.video.findAssetByExternalId.mockResolvedValueOnce(readyAsset);

    await expect(run(input)).resolves.toMatchObject({ assetOrigin: "recovered" });
    expect(input.video.findAssetByExternalId).toHaveBeenCalledWith(film.id);
    expect(input.video.createAsset).not.toHaveBeenCalled();
  });

  it("creates only when absent and persists preparing state before waiting", async () => {
    const input = ports();
    input.video.createAsset.mockResolvedValueOnce(preparingAsset);
    input.video.getAsset.mockResolvedValueOnce(readyAsset);

    await expect(run(input)).resolves.toMatchObject({ assetOrigin: "created" });
    expect(input.repository.sync).toHaveBeenCalledTimes(2);
    expect(input.repository.sync.mock.calls[0]?.[0].asset.state).toBe("PREPARING");
    expect(input.repository.sync.mock.calls[1]?.[0].asset.state).toBe("READY");
    expect(input.delay).toHaveBeenCalledOnce();
  });

  it("fails closed for missing, errored, incomplete, and timed-out assets", async () => {
    const missing = ports("missing-asset");
    missing.video.getAsset.mockResolvedValueOnce(null);
    await expect(run(missing)).rejects.toThrow("Bound Mux asset is missing");

    const errored = ports();
    errored.video.createAsset.mockResolvedValueOnce({ ...readyAsset, state: "ERRORED" });
    await expect(run(errored)).rejects.toThrow("processing failed");

    const incomplete = ports();
    incomplete.video.createAsset.mockResolvedValueOnce({ ...readyAsset, playbackId: null });
    await expect(run(incomplete)).rejects.toThrow("is incomplete");

    const timedOut = ports();
    timedOut.video.createAsset.mockResolvedValueOnce(preparingAsset);
    timedOut.video.getAsset.mockResolvedValue(preparingAsset);
    await expect(run(timedOut)).rejects.toThrow("did not become ready");
  });
});
