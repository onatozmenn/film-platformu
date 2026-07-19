import { describe, expect, it } from "vitest";

import { parseSecurityHeadersEnvironment } from "./security-headers-environment";

describe("security headers environment", () => {
  it("keeps HSTS disabled unless production explicitly enables it", () => {
    expect(parseSecurityHeadersEnvironment({ NODE_ENV: "production" })).toEqual({
      cspEnforced: false,
      hstsEnabled: false,
      releaseId: "local-development",
    });
    expect(
      parseSecurityHeadersEnvironment({
        NODE_ENV: "production",
        PRODUCTION_CSP_ENFORCED: "true",
        PRODUCTION_HSTS_ENABLED: "true",
        RELEASE_ID: "abcdef1234567890",
        SITE_ORIGIN: "https://film.example",
      }),
    ).toEqual({ cspEnforced: true, hstsEnabled: true, releaseId: "abcdef1234567890" });
  });

  it.each([
    {
      NODE_ENV: "test",
      PRODUCTION_CSP_ENFORCED: "true",
      SITE_ORIGIN: "https://film.example",
    },
    {
      NODE_ENV: "production",
      PRODUCTION_CSP_ENFORCED: "true",
      SITE_ORIGIN: "http://film.example",
    },
    {
      NODE_ENV: "test",
      PRODUCTION_HSTS_ENABLED: "true",
      SITE_ORIGIN: "https://film.example",
    },
    {
      NODE_ENV: "production",
      PRODUCTION_HSTS_ENABLED: "true",
      SITE_ORIGIN: "http://film.example",
    },
    {
      NODE_ENV: "production",
      PRODUCTION_HSTS_ENABLED: "true",
      SITE_ORIGIN: "https://localhost:3000",
    },
    {
      NODE_ENV: "production",
      PRODUCTION_HSTS_ENABLED: "true",
      SITE_ORIGIN: "https://film.example/path",
    },
  ])("rejects an unsafe HSTS configuration %#", (source) => {
    expect(() => parseSecurityHeadersEnvironment(source)).toThrow();
  });
});
