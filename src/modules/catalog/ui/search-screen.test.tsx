import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SearchScreen } from "./search-screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("SearchScreen", () => {
  it("shows no fabricated list for a blank query", () => {
    render(<SearchScreen queryState={{ kind: "blank", query: "" }} view={null} />);

    expect(screen.getByRole("heading", { level: 1, name: "Arama" })).toBeVisible();
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("shows concise guidance for a one-character query", () => {
    render(<SearchScreen queryState={{ kind: "too-short", query: "A" }} view={null} />);

    expect(
      screen.getByText("Aramak için en az 2 karakter girin.", {
        selector: ".search-guidance",
      }),
    ).toBeVisible();
  });

  it("shows a domain-specific no-results state", () => {
    render(
      <SearchScreen
        queryState={{ kind: "valid", query: "Olmayan Film" }}
        view={{
          movies: [],
          pageInfo: { page: 1, pageSize: 24, totalPages: 1 },
          total: 0,
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "“Olmayan Film” için sonuç bulunamadı" }),
    ).toBeVisible();
  });

  it("shows long-query guidance", () => {
    render(<SearchScreen queryState={{ kind: "too-long", query: "A".repeat(81) }} view={null} />);

    expect(screen.getByText("Arama en fazla 80 karakter olabilir.")).toBeVisible();
  });

  it("renders populated movie results", () => {
    render(
      <SearchScreen
        queryState={{ kind: "valid", query: "Kıyı" }}
        view={{
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
          pageInfo: { page: 1, pageSize: 24, totalPages: 1 },
          total: 1,
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "“Kıyı” sonuçları" })).toBeVisible();
    expect(screen.getByText("1 film")).toBeVisible();
  });
});
