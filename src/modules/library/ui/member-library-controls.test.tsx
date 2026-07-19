import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MemberLibraryControls } from "./member-library-controls";

const movieId = "00000000-0000-4000-8000-000000000001";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MemberLibraryControls", () => {
  it("gives guests explicit sign-in paths for member actions", () => {
    render(<MemberLibraryControls initialState={null} movieId={movieId} />);

    expect(screen.getByRole("link", { name: "Listeme ekle" })).toHaveAttribute("href", "/giris");
    expect(screen.getByRole("link", { name: "Puan ver" })).toHaveAttribute("href", "/giris");
  });

  it("adds and removes the movie with optimistic pressed state", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MemberLibraryControls
        initialState={{ inWatchlist: false, ratingHalfStars: null, resumeAtSeconds: 0 }}
        movieId={movieId}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Listeme ekle" }));
    expect(screen.getByRole("button", { name: "Listemde" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Listemde" }));

    expect(fetchMock).toHaveBeenNthCalledWith(1, `/api/v1/me/watchlist/${movieId}`, {
      method: "PUT",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, `/api/v1/me/watchlist/${movieId}`, {
      method: "DELETE",
    });
  });

  it("saves integer half-stars through a keyboard-operable range and removes them", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MemberLibraryControls
        initialState={{ inWatchlist: false, ratingHalfStars: 6, resumeAtSeconds: 0 }}
        movieId={movieId}
      />,
    );
    const range = screen.getByRole("slider", { name: "Puanınız" });

    fireEvent.change(range, { target: { value: "8" } });
    fireEvent.keyUp(range, { key: "ArrowRight" });
    await waitFor(() => expect(screen.getByText("4 / 5")).toBeVisible());
    expect(fetchMock).toHaveBeenCalledWith(`/api/v1/me/ratings/${movieId}`, {
      body: JSON.stringify({ valueHalfStars: 8 }),
      headers: { "Content-Type": "application/json; charset=utf-8" },
      method: "PUT",
    });

    await user.click(screen.getByRole("button", { name: "Puanı kaldır" }));
    expect(screen.getByText("Puan yok")).toBeVisible();
    expect(fetchMock).toHaveBeenLastCalledWith(`/api/v1/me/ratings/${movieId}`, {
      method: "DELETE",
    });
  });

  it("rolls back failed optimistic state with safe copy", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    render(
      <MemberLibraryControls
        initialState={{ inWatchlist: false, ratingHalfStars: null, resumeAtSeconds: 0 }}
        movieId={movieId}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Listeme ekle" }));
    expect(screen.getByRole("button", { name: "Listeme ekle" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByText("Liste değişikliği kaydedilemedi.")).toBeVisible();
  });
});
