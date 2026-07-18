import { describe, expect, it } from "vitest";

import { createCatalogHref, parseCatalogFilters } from "./catalog-filters";

describe("catalog filters", () => {
  it("parses supported URL values and rejects malformed values to safe defaults", () => {
    expect(parseCatalogFilters({ siralama: "puan", tur: "dram", yil: "2026" })).toEqual({
      genre: "dram",
      sort: "puan",
      year: 2026,
    });
    expect(parseCatalogFilters({ siralama: "rastgele", tur: "../drafts", yil: "NaN" })).toEqual({
      genre: null,
      sort: "editor-secimi",
      year: null,
    });
  });

  it("builds stable removal links without losing unrelated filters", () => {
    expect(createCatalogHref({ genre: "dram", sort: "puan", year: 2026 }, { genre: null })).toBe(
      "/filmler?yil=2026&siralama=puan",
    );
  });
});
