import { describe, expect, it } from "vitest";

import { parseMovieSlug } from "./movie-slug";

describe("parseMovieSlug", () => {
  it("accepts normalized catalog slugs and rejects traversal or Unicode input", () => {
    expect(parseMovieSlug("ay-isiginda-son-istasyon")).toBe("ay-isiginda-son-istasyon");
    expect(parseMovieSlug("../taslak")).toBeNull();
    expect(parseMovieSlug("gölgeler")).toBeNull();
  });
});
