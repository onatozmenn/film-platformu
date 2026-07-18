import { describe, expect, it } from "vitest";

import { normalizeSearchQuery, parseSuggestionLimit } from "./search-query";

describe("search query boundary", () => {
  it("normalizes whitespace and counts Unicode characters", () => {
    expect(normalizeSearchQuery("  Ay   Işığı ")).toEqual({
      kind: "valid",
      query: "Ay Işığı",
    });
    expect(normalizeSearchQuery("Ö")).toEqual({ kind: "too-short", query: "Ö" });
  });

  it("rejects out-of-range suggestion limits", () => {
    expect(parseSuggestionLimit(null)).toBe(6);
    expect(parseSuggestionLimit("10")).toBe(10);
    expect(parseSuggestionLimit("11")).toBeNull();
  });

  it("distinguishes blank and overlong queries", () => {
    expect(normalizeSearchQuery("   ")).toEqual({ kind: "blank", query: "" });
    expect(normalizeSearchQuery("A".repeat(81))).toEqual({
      kind: "too-long",
      query: "A".repeat(81),
    });
  });
});
