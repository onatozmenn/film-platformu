import { describe, expect, it, vi } from "vitest";

import movieFixture from "./fixtures/tmdb-movie.json";
import searchFixture from "./fixtures/tmdb-search.json";
import { createMetadataProvider } from "./metadata-provider-factory";
import { createTmdbMetadataProvider, type FetchImplementation } from "./tmdb-metadata-provider";

function jsonResponse(body: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

describe("TMDB metadata provider", () => {
  it("maps synthetic search fixtures without putting credentials in the URL", async () => {
    const fetchImplementation = vi.fn<FetchImplementation>(async () => jsonResponse(searchFixture));
    const provider = createTmdbMetadataProvider({
      apiToken: "server-only-test-token",
      fetchImplementation,
    });

    await expect(provider.searchMovies("Kıyı")).resolves.toEqual([
      {
        externalId: "112233",
        originalTitle: "Kiyidaki Sessizlik",
        posterPath: "/kiyi-poster.jpg",
        releaseDate: "2026-02-14",
        synopsis: "A sound recordist follows a forgotten coastal signal.",
        title: "Kıyıdaki Sessizlik",
      },
    ]);

    const [request, init] = fetchImplementation.mock.calls[0] ?? [];
    expect(String(request)).toContain("query=K%C4%B1y%C4%B1");
    expect(String(request)).not.toContain("server-only-test-token");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer server-only-test-token");
  });

  it("maps detail genres and owned credit kinds while dropping unrelated crew", async () => {
    const provider = createTmdbMetadataProvider({
      apiToken: "server-only-test-token",
      fetchImplementation: async () => jsonResponse(movieFixture),
    });

    const movie = await provider.getMovie("112233");

    expect(movie).toMatchObject({
      backdropPath: "/kiyi-backdrop.jpg",
      externalId: "112233",
      genres: [
        { externalId: "18", name: "Dram" },
        { externalId: "9648", name: "Gizem" },
      ],
      provider: "TMDB",
      runtimeMinutes: 98,
    });
    expect(movie?.credits).toEqual([
      expect.objectContaining({ kind: "DIRECTOR", name: "Pelin Somer" }),
      expect.objectContaining({ kind: "WRITER", name: "Baran Tunca" }),
      expect.objectContaining({ characterName: "Ada", kind: "CAST", name: "Ece Derman" }),
    ]);
  });

  it("returns null for a provider 404 and coarse failures for unsafe or invalid data", async () => {
    const missing = createTmdbMetadataProvider({
      apiToken: "server-only-test-token",
      fetchImplementation: async () => jsonResponse({}, 404),
    });
    const malformed = createTmdbMetadataProvider({
      apiToken: "server-only-test-token",
      fetchImplementation: async () => jsonResponse({ results: [{ id: "not-a-number" }] }),
    });

    await expect(missing.getMovie("112233")).resolves.toBeNull();
    await expect(missing.getMovie("https://example.test/movie/1")).rejects.toMatchObject({
      code: "invalid-request",
    });
    await expect(malformed.searchMovies("Kıyı")).rejects.toMatchObject({
      code: "invalid-response",
    });
  });

  it("maps transport errors to an unavailable failure without leaking details", async () => {
    const provider = createTmdbMetadataProvider({
      apiToken: "server-only-test-token",
      fetchImplementation: async () => {
        throw new Error("socket included sensitive provider context");
      },
    });

    await expect(provider.searchMovies("Kıyı")).rejects.toMatchObject({
      code: "unavailable",
      message: "Metadata provider request failed",
    });
  });

  it("uses the disabled adapter by default without touching fetch", async () => {
    const fetchImplementation = vi.fn<FetchImplementation>();
    const provider = createMetadataProvider({ kind: "disabled" }, { fetchImplementation });

    await expect(provider.searchMovies("Kıyı")).rejects.toMatchObject({ code: "disabled" });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });
});
