import { describe, expect, it } from "vitest";

import { createCatalogHref, parseCatalogFilters } from "./catalog-filters";

describe("catalog filters", () => {
  it("parses supported URL values and rejects malformed values to safe defaults", () => {
    expect(parseCatalogFilters({ siralama: "puan", tur: "dram", yil: "2026" })).toEqual({
      genre: "dram",
      page: 1,
      sort: "puan",
      year: 2026,
    });
    expect(
      parseCatalogFilters({ sayfa: "-4", siralama: "rastgele", tur: "../drafts", yil: "NaN" }),
    ).toEqual({ genre: null, page: 1, sort: "editor-secimi", year: null });
  });

  it("builds stable removal links without losing unrelated filters", () => {
    const filters = { genre: "dram", page: 3, sort: "puan", year: 2026 } as const;

    expect(createCatalogHref(filters, { genre: null })).toBe("/filmler?yil=2026&siralama=puan");
    expect(createCatalogHref(filters, { page: 2 })).toBe(
      "/filmler?tur=dram&yil=2026&siralama=puan&sayfa=2",
    );
  });
});
