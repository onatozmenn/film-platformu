import { describe, expect, it } from "vitest";

import { emailLinkRateLimitKey, isEmailLinkRequest } from "./email-link-request-rate-limit";

describe("email-link request rate-limit boundary", () => {
  it("classifies only the Auth.js email sign-in mutation", () => {
    expect(isEmailLinkRequest("POST", ["signin", "email"])).toBe(true);
    expect(isEmailLinkRequest("GET", ["signin", "email"])).toBe(false);
    expect(isEmailLinkRequest("POST", ["signout"])).toBe(false);
    expect(isEmailLinkRequest("POST", ["callback", "email"])).toBe(false);
  });

  it("uses a trusted edge address only when deployment trust is explicit", () => {
    const headers = new Headers({ "x-real-ip": " 203.0.113.10 " });

    expect(emailLinkRateLimitKey(headers, true)).toBe("203.0.113.10");
    expect(emailLinkRateLimitKey(new Headers(), true)).toBe("unresolved-visitor");
    expect(emailLinkRateLimitKey(headers, false)).toBe("untrusted-deployment");
  });
});
