import { describe, expect, it } from "vitest";

import { parseStagingOrigin, parseStagingReleaseId } from "./staging-origin";

describe("staging origin", () => {
  it("accepts only a canonical public HTTPS origin", () => {
    expect(parseStagingOrigin("https://staging.film.example/")).toBe(
      "https://staging.film.example",
    );
    expect(() => parseStagingOrigin(undefined)).toThrow();
    expect(() => parseStagingOrigin("http://staging.film.example")).toThrow();
    expect(() => parseStagingOrigin("https://localhost:3100")).toThrow();
    expect(() => parseStagingOrigin("https://staging.film.example/path")).toThrow();
  });

  it("requires a bounded immutable staging release identifier", () => {
    expect(parseStagingReleaseId("abcdef1234567890")).toBe("abcdef1234567890");
    expect(() => parseStagingReleaseId(undefined)).toThrow();
    expect(() => parseStagingReleaseId("local")).toThrow();
    expect(() => parseStagingReleaseId("release with spaces")).toThrow();
  });
});
