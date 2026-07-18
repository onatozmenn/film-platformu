import { describe, expect, it } from "vitest";

import { createFixedWindowRateLimiter } from "./fixed-window-rate-limiter";

describe("fixed-window rate limiter", () => {
  it("limits each key independently and resets at the exact window boundary", () => {
    let now = 1_000;
    const limiter = createFixedWindowRateLimiter(2, 60_000, () => now);

    expect(limiter.consume("visitor-a")).toBe(true);
    expect(limiter.consume("visitor-a")).toBe(true);
    expect(limiter.consume("visitor-a")).toBe(false);
    expect(limiter.consume("visitor-b")).toBe(true);

    now = 61_000;
    expect(limiter.consume("visitor-a")).toBe(true);
  });

  it("evicts the oldest key when the bounded map reaches capacity", () => {
    const limiter = createFixedWindowRateLimiter(1, 60_000, () => 1_000, 2);

    expect(limiter.consume("visitor-a")).toBe(true);
    expect(limiter.consume("visitor-a")).toBe(false);
    expect(limiter.consume("visitor-b")).toBe(true);
    expect(limiter.consume("visitor-c")).toBe(true);
    expect(limiter.consume("visitor-a")).toBe(true);
  });
});
