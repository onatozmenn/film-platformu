import { describe, expect, it } from "vitest";

import {
  parseAssetFormData,
  parseCollectionFormData,
  parseCreditsFormData,
  parseEditorialFormData,
  parseMetadataExternalId,
  parseRightFormData,
  parseScheduleFormData,
  parseSubtitlesFormData,
} from "./admin-form-input";

const movieId = "00000000-0000-4000-8000-000000000001";
const genreId = "10000000-0000-4000-8000-000000000002";

function editorialForm(): FormData {
  const form = new FormData();
  form.set("ageRating", " 13+ ");
  form.set("backdropAlt", "Fon");
  form.set("backdropFocalPosition", "50% 50%");
  form.set("backdropHeight", "1200");
  form.set("backdropSrc", "/fixtures/catalog/theater-interior.jpg");
  form.set("backdropWidth", "1800");
  form.set("genreIds", genreId);
  form.set("originalTitle", "");
  form.set("posterAlt", "Afiş");
  form.set("posterFocalPosition", "50% 50%");
  form.set("posterHeight", "1200");
  form.set("posterSrc", "/fixtures/catalog/fog-coast.jpg");
  form.set("posterWidth", "800");
  form.set("releaseDate", "2026-01-01");
  form.set("runtimeMinutes", "98");
  form.set("slug", "yonetim-filmi");
  form.set("synopsis", "Yeterince uzun kurgusal film özeti.");
  form.set("title", " Yönetim Filmi ");
  return form;
}

describe("admin form input", () => {
  it("normalizes bounded editorial, rights, schedule, and asset input", () => {
    expect(parseEditorialFormData(editorialForm())).toMatchObject({
      ageRating: "13+",
      originalTitle: null,
      releaseDate: new Date("2026-01-01T00:00:00.000Z"),
      runtimeMinutes: 98,
      title: "Yönetim Filmi",
    });

    const right = new FormData();
    right.set("allowStreaming", "on");
    right.set("endsAt", "2026-08-01T00:00");
    right.set("evidenceReference", "license:fixture/tr-2026");
    right.set("movieId", movieId);
    right.set("rightId", "");
    right.set("startsAt", "2026-07-01T00:00");
    right.set("territory", "TR");
    expect(parseRightFormData(right)).toEqual({
      allowStreaming: true,
      endsAt: new Date("2026-08-01T00:00:00.000Z"),
      evidenceReference: "license:fixture/tr-2026",
      movieId,
      rightId: null,
      startsAt: new Date("2026-07-01T00:00:00.000Z"),
      territory: "TR",
    });

    const schedule = new FormData();
    schedule.set("expectedRevision", "2");
    schedule.set("movieId", movieId);
    schedule.set("publishAt", "2026-07-20T12:00");
    expect(parseScheduleFormData(schedule)).toEqual({
      id: movieId,
      publishAt: new Date("2026-07-20T12:00:00.000Z"),
      revision: 2,
    });

    const asset = new FormData();
    asset.set("makeActive", "on");
    asset.set("movieId", movieId);
    asset.set("providerAssetId", "fake-asset-admin-ready");
    expect(parseAssetFormData(asset)).toEqual({
      makeActive: true,
      movieId,
      providerAssetId: "fake-asset-admin-ready",
    });
  });

  it("parses aligned credit and subtitle rows while omitting blank additions", () => {
    const credits = new FormData();
    for (const value of ["Yönetmen", ""]) credits.append("creditName", value);
    for (const value of ["DIRECTOR", "CAST"]) credits.append("creditKind", value);
    for (const value of ["0", "1"]) credits.append("creditOrder", value);
    for (const value of ["", ""]) credits.append("creditCharacter", value);
    for (const value of ["", ""]) credits.append("creditLabel", value);
    expect(parseCreditsFormData(credits)).toEqual([
      {
        billingOrder: 0,
        characterName: null,
        displayLabel: null,
        kind: "DIRECTOR",
        personName: "Yönetmen",
      },
    ]);

    const subtitles = new FormData();
    for (const value of ["tr", ""]) subtitles.append("subtitleLanguage", value);
    for (const value of ["Türkçe", ""]) subtitles.append("subtitleLabel", value);
    for (const value of ["SUBTITLES", "SUBTITLES"]) subtitles.append("subtitleKind", value);
    for (const value of ["track-tr", ""]) subtitles.append("subtitleProviderId", value);
    for (const value of ["true", "false"]) subtitles.append("subtitleDefault", value);
    expect(parseSubtitlesFormData(subtitles)).toEqual([
      {
        isDefault: true,
        kind: "SUBTITLES",
        label: "Türkçe",
        languageTag: "tr",
        providerTrackId: "track-tr",
      },
    ]);

    credits.delete("creditLabel");
    expect(parseCreditsFormData(credits)).toBeNull();
  });

  it("assigns stable collection positions and rejects duplicated choices", () => {
    const collection = new FormData();
    collection.set("collectionId", "");
    collection.set("description", "Seçki açıklaması");
    collection.set("displayOrder", "2");
    collection.set("expectedRevision", "");
    collection.append("movieIds", movieId);
    collection.append("movieIds", "00000000-0000-4000-8000-000000000002");
    collection.set("slug", "yeni-secki");
    collection.set("state", "DRAFT");
    collection.set("title", "Yeni Seçki");

    expect(parseCollectionFormData(collection)).toMatchObject({
      movies: [
        { movieId, position: 0 },
        { movieId: "00000000-0000-4000-8000-000000000002", position: 1 },
      ],
    });
    collection.append("movieIds", movieId);
    expect(parseCollectionFormData(collection)).toBeNull();
  });

  it("rejects arbitrary images, malformed dates, and invalid identifiers", () => {
    const editorial = editorialForm();
    editorial.set("posterSrc", "https://attacker.example/poster.jpg");
    expect(parseEditorialFormData(editorial)).toBeNull();

    const schedule = new FormData();
    schedule.set("expectedRevision", "0");
    schedule.set("movieId", "not-a-uuid");
    schedule.set("publishAt", "not-a-date");
    expect(parseScheduleFormData(schedule)).toBeNull();

    const metadata = new FormData();
    metadata.set("externalId", " 42 ");
    expect(parseMetadataExternalId(metadata)).toBe("42");
    metadata.set("externalId", "https://example.com/movie/42");
    expect(parseMetadataExternalId(metadata)).toBeNull();
  });
});
