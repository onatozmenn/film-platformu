import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { GET } from "./route";

vi.mock("@/modules/catalog/server", () => ({
  catalogQueries: {
    suggestMovies: async () => [
      {
        id: "00000000-0000-4000-8000-000000000007",
        kind: "movie",
        poster: null,
        slug: "ay-isiginda-son-istasyon",
        title: "Ay Işığında Son İstasyon",
        year: 2026,
      },
    ],
  },
}));

describe("search suggestions route", () => {
  it("returns the narrow suggestion contract with cache and request headers", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/search/suggestions?q=Nehir%20Ekin&limit=1",
      { headers: { "x-request-id": "req_test" } },
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=30, s-maxage=60");
    expect(response.headers.get("x-request-id")).toBe("req_test");
    await expect(response.json()).resolves.toEqual({
      data: [
        expect.objectContaining({
          kind: "movie",
          slug: "ay-isiginda-son-istasyon",
          title: "Ay Işığında Son İstasyon",
        }),
      ],
    });
  });

  it("returns Problem Details for invalid queries", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/v1/search/suggestions?q=A&limit=20"),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toBe("application/problem+json; charset=utf-8");
    await expect(response.json()).resolves.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});
