import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { HomePageView } from "../application/catalog-query-port";
import { HomeScreen } from "./home-screen";

const movie = {
  ageRating: "13+",
  backdrop: null,
  genres: ["Dram"],
  id: "00000000-0000-4000-8000-000000000001",
  poster: null,
  rating: null,
  runtimeMinutes: 98,
  slug: "kiyidaki-sessizlik",
  synopsis: "Sessiz bir kıyı kasabasında geçmişin izleri yeniden belirir.",
  title: "Kıyıdaki Sessizlik",
  year: 2026,
} as const;

const view: HomePageView = {
  featured: movie,
  rails: [
    {
      id: "featured",
      movies: [movie],
      title: "Editörün seçkisi",
      variant: "standard",
      viewAllHref: "/filmler",
    },
  ],
};

describe("HomeScreen", () => {
  it("renders the featured film and stable detail links", () => {
    render(<HomeScreen view={view} />);

    expect(screen.getByRole("heading", { level: 1, name: movie.title })).toBeVisible();
    expect(screen.getAllByRole("link", { name: /Kıyıdaki Sessizlik/u })[0]).toHaveAttribute(
      "href",
      `/film/${movie.slug}`,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Editörün seçkisi" })).toBeVisible();
  });
});
