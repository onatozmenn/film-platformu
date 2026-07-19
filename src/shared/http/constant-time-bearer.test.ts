import { describe, expect, it } from "vitest";

import { verifyBearerCredential } from "./constant-time-bearer";

describe("constant-time bearer verification", () => {
  const secret = "c".repeat(32);

  it("accepts only the exact bearer credential", () => {
    expect(verifyBearerCredential(`Bearer ${secret}`, secret)).toBe(true);
    expect(verifyBearerCredential(`bearer ${secret}`, secret)).toBe(false);
    expect(verifyBearerCredential(`Bearer ${secret}x`, secret)).toBe(false);
    expect(verifyBearerCredential("Bearer ", secret)).toBe(false);
    expect(verifyBearerCredential(null, secret)).toBe(false);
  });
});
