import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("renders the Turkish catalogue-empty shell", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { level: 1, name: "Film Platform" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Ana içeriğe geç" })).toHaveAttribute(
      "href",
      "#ana-icerik",
    );
    expect(screen.getByText("Seçki hazırlanıyor.")).toBeVisible();
  });
});
