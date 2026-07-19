import { describe, expect, it } from "vitest";

import { durationsAreCompatible, evaluateProgress } from "./progress-policy";

const now = new Date("2026-07-19T12:00:00.000Z");

function progress(positionSeconds: number, durationSeconds: number, observedAt: Date = now) {
  return evaluateProgress({ durationSeconds, now, observedAt, positionSeconds });
}

describe("progress policy", () => {
  it("clamps positions to the accepted duration", () => {
    expect(progress(-10, 100)).toMatchObject({
      accepted: true,
      value: { completed: false, positionSeconds: 0 },
    });
    expect(progress(110, 100)).toMatchObject({
      accepted: true,
      value: { completed: true, positionSeconds: 100 },
    });
  });

  it("completes short content at the exact 95 percent boundary only", () => {
    expect(progress(94.999, 100)).toMatchObject({
      accepted: true,
      value: { completed: false },
    });
    expect(progress(95, 100)).toMatchObject({
      accepted: true,
      value: { completed: true },
    });
  });

  it("uses the 120-second rule only for content at least 20 minutes long", () => {
    expect(progress(1_079, 1_199)).toMatchObject({
      accepted: true,
      value: { completed: false },
    });
    expect(progress(1_080, 1_200)).toMatchObject({
      accepted: true,
      value: { completed: true },
    });
    expect(progress(1_079, 1_200)).toMatchObject({
      accepted: true,
      value: { completed: false },
    });
  });

  it.each([
    [Number.NaN, 100],
    [Number.POSITIVE_INFINITY, 100],
    [10, Number.NaN],
    [10, Number.POSITIVE_INFINITY],
    [10, 0],
    [10, -1],
    [10, 43_201],
  ])("rejects impossible position %s or duration %s", (positionSeconds, durationSeconds) => {
    expect(progress(positionSeconds, durationSeconds)).toEqual({
      accepted: false,
      reason: "INVALID_PROGRESS",
    });
  });

  it("accepts the exact future-skew boundary and rejects later or invalid observations", () => {
    expect(progress(10, 100, new Date("2026-07-19T12:05:00.000Z"))).toMatchObject({
      accepted: true,
    });
    expect(progress(10, 100, new Date("2026-07-19T12:05:00.001Z"))).toEqual({
      accepted: false,
      reason: "INVALID_OBSERVATION",
    });
    expect(progress(10, 100, new Date(Number.NaN))).toEqual({
      accepted: false,
      reason: "INVALID_OBSERVATION",
    });
    expect(
      evaluateProgress({
        durationSeconds: 100,
        now: new Date(Number.NaN),
        observedAt: now,
        positionSeconds: 10,
      }),
    ).toEqual({ accepted: false, reason: "INVALID_OBSERVATION" });
  });

  it("accepts bounded duration drift and rejects invalid or implausible changes", () => {
    expect(durationsAreCompatible(100, 105)).toBe(true);
    expect(durationsAreCompatible(1_000, 1_020)).toBe(true);
    expect(durationsAreCompatible(100, 105.001)).toBe(false);
    expect(durationsAreCompatible(1_000, 1_020.001)).toBe(false);
    expect(durationsAreCompatible(0, 100)).toBe(false);
    expect(durationsAreCompatible(100, Number.NaN)).toBe(false);
  });
});
