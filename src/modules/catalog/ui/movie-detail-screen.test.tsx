import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MovieDetailView } from "../application/catalog-query-port";
import { MovieDetailScreen } from "./movie-detail-screen";

const movie: MovieDetailView = {
  ageRating: null,
  backdrop: null,
  credits: [{ label: "Yönetmen", names: ["Pelin Somer"] }],
  genres: ["Dram"],
  id: "00000000-0000-4000-8000-000000000001",
  isPlayable: false,
  originalTitle: null,
  poster: null,
  rating: null,
  runtimeMinutes: 98,
  similarMovies: [],
  slug: "kiyidaki-sessizlik",
  subtitleLanguages: [],
  synopsis: "Sessiz bir kıyı kasabasında geçmişin izleri yeniden belirir.",
  title: "Kıyıdaki Sessizlik",
  year: 2026,
};

describe("MovieDetailScreen", () => {
  it("omits absent optional metadata and fails closed without a watch link", () => {
    render(<MovieDetailScreen movie={movie} />);

    expect(screen.getByRole("heading", { level: 1, name: movie.title })).toBeVisible();
    expect(screen.getByText("Bu film şu anda oynatılamıyor.")).toBeVisible();
    expect(screen.queryByRole("link", { name: "İzle" })).not.toBeInTheDocument();
    expect(screen.queryByText("Altyazılar")).not.toBeInTheDocument();
    expect(screen.getByText("Pelin Somer")).toBeVisible();
  });

  it("renders all optional detail sections and a playable long-title action", () => {
    const fullMovie: MovieDetailView = {
      ...movie,
      ageRating: "13+",
      backdrop: {
        alt: "Sisli kıyı",
        focalPosition: "50% 50%",
        height: 900,
        src: "/fixtures/catalog/fog-coast.jpg",
        width: 1600,
      },
      isPlayable: true,
      originalTitle: "The Silent Coast",
      poster: {
        alt: "Kıyıdaki Sessizlik afişi",
        focalPosition: "50% 50%",
        height: 900,
        src: "/fixtures/catalog/fog-coast.jpg",
        width: 600,
      },
      rating: { average: 4.3, count: 24 },
      similarMovies: [movie],
      subtitleLanguages: ["Türkçe", "İngilizce"],
      title: "Rüzgârın Unuttuğu Şehrin Bitmek Bilmeyen Uzun Gecesi",
    };
    render(<MovieDetailScreen movie={fullMovie} />);

    expect(screen.getByRole("link", { name: "İzle" })).toHaveAttribute(
      "href",
      "/izle/kiyidaki-sessizlik",
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveClass("detail-title--long");
    expect(screen.getByText("The Silent Coast")).toBeVisible();
    expect(screen.getByText("4,3 / 5")).toBeVisible();
    expect(screen.getByText("Türkçe, İngilizce")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Benzer filmler" })).toBeVisible();
  });
});
