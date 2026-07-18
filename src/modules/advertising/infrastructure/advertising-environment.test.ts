import { describe, expect, it } from "vitest";

import { parseAdvertisingEnvironment } from "./advertising-environment";

describe("advertising environment", () => {
  it("defaults to disabled", () => {
    expect(parseAdvertisingEnvironment({ NODE_ENV: "test" })).toEqual({
      nodeEnvironment: "test",
      provider: { kind: "disabled" },
    });
  });

  it("selects a deterministic fake scenario outside production", () => {
    expect(
      parseAdvertisingEnvironment({
        ADVERTISING_PROVIDER: "fake",
        ADVERTISING_TEST_SCENARIO: "blocked",
        NODE_ENV: "test",
      }),
    ).toEqual({
      nodeEnvironment: "test",
      provider: { fixtureScenario: "blocked", kind: "fake" },
    });
    expect(parseAdvertisingEnvironment({ ADVERTISING_PROVIDER: "fake" }).provider).toEqual({
      fixtureScenario: "completed",
      kind: "fake",
    });
  });

  it("rejects fake production advertising and stray fixture configuration", () => {
    expect(() =>
      parseAdvertisingEnvironment({ ADVERTISING_PROVIDER: "fake", NODE_ENV: "production" }),
    ).toThrow("Production advertising is blocked until the consent ADR is accepted");
    expect(() =>
      parseAdvertisingEnvironment({ ADVERTISING_TEST_SCENARIO: "error", NODE_ENV: "test" }),
    ).toThrow("ADVERTISING_TEST_SCENARIO requires ADVERTISING_PROVIDER=fake");
  });
});
