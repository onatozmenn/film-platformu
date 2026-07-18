import { describe, expect, it } from "vitest";

import { createPrerollProviderConfiguration } from "./fake-preroll-provider";

describe("fake preroll provider", () => {
  it("stays disabled when no test provider is selected", () => {
    expect(
      createPrerollProviderConfiguration({
        nodeEnvironment: "test",
        provider: { kind: "disabled" },
      }),
    ).toEqual({ kind: "disabled" });
  });

  it("builds fixed Google sample tags with non-personalized mode separated", () => {
    const configuration = createPrerollProviderConfiguration({
      nodeEnvironment: "test",
      provider: { fixtureScenario: "empty", kind: "fake" },
    });
    if (configuration.kind === "disabled") {
      throw new Error("Expected the fake provider configuration");
    }
    const personalized = new URL(configuration.personalizedTagUrl);
    const nonPersonalized = new URL(configuration.nonPersonalizedTagUrl);

    expect(configuration.fixtureScenario).toBe("empty");
    expect(personalized.origin).toBe("https://pubads.g.doubleclick.net");
    expect(personalized.pathname).toBe("/gampad/ads");
    expect(personalized.searchParams.get("iu")).toBe("/21775744923/external/single_ad_samples");
    expect(personalized.searchParams.get("output")).toBe("vast");
    expect(personalized.searchParams.has("npa")).toBe(false);
    expect(nonPersonalized.searchParams.get("npa")).toBe("1");
  });
});
