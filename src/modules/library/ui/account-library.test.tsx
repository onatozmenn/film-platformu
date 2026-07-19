import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MovieCardView } from "@/modules/catalog/application/catalog-query-port";

import { AccountLibrary } from "./account-library";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const movie: MovieCardView = {
  id: "00000000-0000-4000-8000-000000000001",
  poster: null,
  rating: null,
  slug: "kiyidaki-sessizlik",
  title: "Kıyıdaki Sessizlik",
  year: 2026,
};

describe("AccountLibrary", () => {
  it("names both empty collections and provides valid discovery actions", () => {
    render(<AccountLibrary library={{ continueWatching: [], watchlist: [] }} />);

    expect(screen.getByRole("heading", { name: "İzlemeye devam et" })).toBeVisible();
    expect(screen.getByText("Yarım bıraktığınız filmler burada görünür.")).toBeVisible();
    expect(screen.getByText("Listenizde henüz film yok.")).toBeVisible();
    expect(
      screen.getAllByRole("link").every((link) => link.getAttribute("href") === "/filmler"),
    ).toBe(true);
  });

  it("renders canonical watchlist and direct resume items", () => {
    render(
      <AccountLibrary
        library={{
          continueWatching: [{ movie, progressPercent: 40 }],
          watchlist: [movie],
        }}
      />,
    );

    expect(
      screen
        .getAllByRole("link", { name: /Kıyıdaki Sessizlik/u })
        .find((link) => link.getAttribute("href")?.startsWith("/izle/")),
    ).toHaveAttribute("href", "/izle/kiyidaki-sessizlik");
    expect(screen.getByLabelText("Yüzde 40 izlendi")).toBeVisible();
    expect(screen.getByRole("button", { name: "Geçmişi temizle" })).toBeVisible();
  });
});
