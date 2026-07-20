import { describe, expect, it, vi } from "vitest";

import openFilmCatalog from "@/content/open-film-catalog.json";
import { parseOpenFilmManifest } from "@/modules/catalog/application/open-film-manifest";

import { createMuxOpenFilmIngest, type MuxOpenFilmClient } from "./mux-open-film-ingest";

function firstValue<T>(values: readonly T[]): T {
  const value = values[0];
  if (value === undefined) throw new Error("Missing fixture value");
  return value;
}

const film = firstValue(parseOpenFilmManifest(openFilmCatalog).films);

const readyAsset = {
  duration: 596.2,
  id: "mux-asset",
  meta: { external_id: film.id },
  playback_ids: [
    { id: "public-id", policy: "public" },
    { id: "signed-id", policy: "signed" },
  ],
  status: "ready",
} as const;

function client(listed: readonly unknown[] = []) {
  return {
    assets: {
      create: vi.fn<MuxOpenFilmClient["assets"]["create"]>(async () => readyAsset),
      async *list() {
        for (const asset of listed) yield asset;
      },
      retrieve: vi.fn<MuxOpenFilmClient["assets"]["retrieve"]>(async () => readyAsset),
    },
  } satisfies MuxOpenFilmClient;
}

describe("Mux open film ingest", () => {
  it("creates a basic signed asset with non-PII correlation metadata", async () => {
    const sdk = client();
    const ingest = createMuxOpenFilmIngest({ tokenId: "id", tokenSecret: "secret" }, sdk);

    await expect(ingest.createAsset(film)).resolves.toEqual({
      durationSeconds: 596,
      id: "mux-asset",
      playbackId: "signed-id",
      state: "READY",
    });
    expect(sdk.assets.create).toHaveBeenCalledWith({
      inputs: [{ url: film.video.sourceUrl }],
      meta: {
        creator_id: "blender-foundation",
        external_id: film.id,
        title: film.title,
      },
      normalize_audio: false,
      passthrough: `open-film:${film.id}`,
      playback_policies: ["signed"],
      video_quality: "basic",
    });
  });

  it("recovers a unique asset by external ID and maps only its signed playback ID", async () => {
    const ingest = createMuxOpenFilmIngest(
      { tokenId: "id", tokenSecret: "secret" },
      client([{ ...readyAsset, meta: { external_id: "other" } }, readyAsset]),
    );

    await expect(ingest.findAssetByExternalId(film.id)).resolves.toMatchObject({
      id: "mux-asset",
      playbackId: "signed-id",
    });
  });

  it("fails closed for duplicate external IDs and malformed provider data", async () => {
    const duplicate = createMuxOpenFilmIngest(
      { tokenId: "id", tokenSecret: "secret" },
      client([readyAsset, { ...readyAsset, id: "duplicate" }]),
    );
    await expect(duplicate.findAssetByExternalId(film.id)).rejects.toThrow("Multiple Mux assets");

    const malformed = client();
    malformed.assets.retrieve.mockResolvedValueOnce({ id: "missing-status" });
    const ingest = createMuxOpenFilmIngest({ tokenId: "id", tokenSecret: "secret" }, malformed);
    await expect(ingest.getAsset("missing-status")).rejects.toThrow();
  });
});
