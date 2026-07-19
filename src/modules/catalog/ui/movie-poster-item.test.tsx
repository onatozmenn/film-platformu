import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MovieCardView } from "../application/catalog-query-port";
import { MoviePosterItem } from "./movie-poster-item";

const imageMovie: MovieCardView = {
  id: "00000000-0000-4000-8000-000000000001",
  poster: {
    alt: "Sisli kıyı",
    focalPosition: "50% 50%",
    height: 900,
    src: "/fixtures/catalog/fog-coast.jpg",
    width: 600,
  },
  rating: { average: 4.3, count: 24 },
  slug: "kiyidaki-sessizlik",
  title: "Kıyıdaki Sessizlik",
  year: 2026,
};

describe("MoviePosterItem", () => {
  it("renders an eager image, rating, and ranked accessible link", () => {
    render(<MoviePosterItem eager movie={imageMovie} rank={1} />);

    expect(screen.getByRole("img", { name: "Sisli kıyı" })).toHaveAttribute("loading", "eager");
    expect(screen.getByRole("link", { name: "1. sırada Kıyıdaki Sessizlik" })).toHaveAttribute(
      "href",
      "/film/kiyidaki-sessizlik",
    );
    expect(screen.getByText("2026 · 4,3 / 5")).toBeVisible();
  });

  it("renders a typographic placeholder without a synthetic rating", () => {
    render(<MoviePosterItem movie={{ ...imageMovie, poster: null, rating: null }} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("2026")).toBeVisible();
  });

  it("supports an accessible continue-watching destination and progress cue", () => {
    render(
      <MoviePosterItem href="/izle/kiyidaki-sessizlik" movie={imageMovie} progressPercent={42} />,
    );

    expect(screen.getByRole("link", { name: /Kıyıdaki Sessizlik/u })).toHaveAttribute(
      "href",
      "/izle/kiyidaki-sessizlik",
    );
    expect(screen.getByLabelText("Yüzde 42 izlendi")).toBeVisible();
  });
});
