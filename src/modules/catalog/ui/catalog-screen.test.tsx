import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CatalogPageView } from "../application/catalog-query-port";
import { CatalogScreen } from "./catalog-screen";

const emptyView: CatalogPageView = {
  availableGenres: [{ name: "Dram", slug: "dram" }],
  availableYears: [2026],
  movies: [],
  total: 0,
};

describe("CatalogScreen", () => {
  it("keeps active filters visible in the no-results state", () => {
    render(
      <CatalogScreen
        filters={{ genre: "dram", sort: "editor-secimi", year: 2026 }}
        view={emptyView}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Filmler" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Bu filtrelerle eşleşen film yok" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Dram filtresini kaldır" })).toHaveAttribute(
      "href",
      "/filmler?yil=2026",
    );
    expect(screen.getByRole("link", { name: "Filtreleri temizle" })).toHaveAttribute(
      "href",
      "/filmler",
    );
  });

  it("renders populated results without an active-filter region", () => {
    render(
      <CatalogScreen
        filters={{ genre: null, sort: "editor-secimi", year: null }}
        view={{
          ...emptyView,
          movies: [
            {
              id: "00000000-0000-4000-8000-000000000001",
              poster: null,
              rating: null,
              slug: "kiyidaki-sessizlik",
              title: "Kıyıdaki Sessizlik",
              year: 2026,
            },
          ],
          total: 1,
        }}
      />,
    );

    expect(screen.getByText("1 sonuç")).toBeVisible();
    expect(screen.queryByLabelText("Etkin filtreler")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Kıyıdaki Sessizlik/u })).toBeVisible();
  });
});
