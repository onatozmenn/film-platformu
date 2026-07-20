import { describe, expect, it } from "vitest";

import openFilmCatalog from "@/content/open-film-catalog.json";

import { getCatalogAttribution } from "./catalog-attribution";
import { parseOpenFilmManifest } from "./open-film-manifest";

describe("open film manifest", () => {
  function firstValue<T>(values: readonly T[]): T {
    const value = values[0];
    if (value === undefined) throw new Error("Missing fixture value");
    return value;
  }

  it("accepts the reviewed Big Buck Bunny record", () => {
    const manifest = parseOpenFilmManifest(openFilmCatalog);

    expect(manifest.films).toHaveLength(4);
    expect(manifest.films).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "00000000-0000-4000-8000-000000000011",
          license: expect.objectContaining({ id: "CC-BY-3.0" }),
          slug: "big-buck-bunny",
          video: expect.objectContaining({ videoQuality: "basic" }),
        }),
        expect.objectContaining({
          license: expect.objectContaining({ id: "CC-BY-3.0" }),
          slug: "sintel",
        }),
        expect.objectContaining({
          license: expect.objectContaining({ id: "CC-BY-3.0" }),
          slug: "tears-of-steel",
        }),
        expect.objectContaining({
          license: expect.objectContaining({ id: "CC-BY-2.5" }),
          slug: "elephants-dream",
        }),
      ]),
    );
  });

  it("rejects duplicate records and non-HTTPS video sources", () => {
    const duplicate = structuredClone(openFilmCatalog);
    duplicate.films.push(structuredClone(firstValue(duplicate.films)));
    expect(() => parseOpenFilmManifest(duplicate)).toThrow();

    const insecure = structuredClone(openFilmCatalog);
    firstValue(insecure.films).video.sourceUrl = "http://example.com/movie.mp4";
    expect(() => parseOpenFilmManifest(insecure)).toThrow();

    const unapprovedHost = structuredClone(openFilmCatalog);
    firstValue(unapprovedHost.films).video.sourceUrl = "https://example.com/movie.mp4";
    expect(() => parseOpenFilmManifest(unapprovedHost)).toThrow();
  });

  it("provides visible attribution from the same reviewed manifest", () => {
    expect(getCatalogAttribution("big-buck-bunny")).toEqual({
      copyrightNotice: "(c) copyright 2008, Blender Foundation / www.bigbuckbunny.org",
      creator: "Blender Foundation",
      licenseLabel: "Creative Commons Attribution 3.0",
      licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
      notice: "Film değiştirilmeden sunulur ve özgün jeneriği korunur.",
      sourceUrl: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    });
  });
});
