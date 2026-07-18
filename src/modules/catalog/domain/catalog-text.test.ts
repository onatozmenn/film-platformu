import { describe, expect, it } from "vitest";

import { createMovieSlug, normalizeCatalogSearchText } from "./catalog-text";

describe("catalog text normalization", () => {
  it("normalizes Turkish casing and combining marks for search", () => {
    expect(normalizeCatalogSearchText("  KIYIDAKİ   ŞEHİR  ")).toBe("kiyidaki sehir");
  });

  it("creates an ASCII slug capped at 96 characters", () => {
    expect(createMovieSlug("Rüzgârın Unuttuğu Şehir")).toBe("ruzgarin-unuttugu-sehir");
    expect(createMovieSlug("A".repeat(120))).toHaveLength(96);
  });
});
