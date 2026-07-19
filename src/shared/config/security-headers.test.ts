import { describe, expect, it } from "vitest";

import { buildSecurityHeaders } from "./security-headers";

describe("security headers", () => {
  it("keeps the report-only CSP and excludes HSTS before production approval", () => {
    const headers = buildSecurityHeaders({
      cspEnforced: false,
      hstsEnabled: false,
      releaseId: "local-development",
    });

    expect(headers).toContainEqual(
      expect.objectContaining({ key: "Content-Security-Policy-Report-Only" }),
    );
    expect(headers).not.toContainEqual(
      expect.objectContaining({ key: "Strict-Transport-Security" }),
    );
  });

  it("adds the approved production HSTS policy without preload", () => {
    expect(
      buildSecurityHeaders({
        cspEnforced: false,
        hstsEnabled: true,
        releaseId: "release-abcdef1",
      }),
    ).toEqual(
      expect.arrayContaining([
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        { key: "X-Release-Id", value: "release-abcdef1" },
      ]),
    );
  });

  it("replaces report-only CSP only after explicit production enforcement", () => {
    const headers = buildSecurityHeaders({
      cspEnforced: true,
      hstsEnabled: true,
      releaseId: "release-abcdef1",
    });

    expect(headers).toContainEqual(expect.objectContaining({ key: "Content-Security-Policy" }));
    expect(headers).not.toContainEqual(
      expect.objectContaining({ key: "Content-Security-Policy-Report-Only" }),
    );
  });
});
