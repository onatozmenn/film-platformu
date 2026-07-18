import { describe, expect, it } from "vitest";

import {
  decidePreroll,
  type AdvertisingConsentState,
  type PrerollProviderConfiguration,
} from "./preroll-policy";

const provider: PrerollProviderConfiguration = {
  fixtureScenario: "completed",
  kind: "google-ima",
  nonPersonalizedTagUrl: "https://pubads.g.doubleclick.net/gampad/ads?iu=test&npa=1",
  personalizedTagUrl: "https://pubads.g.doubleclick.net/gampad/ads?iu=test",
};

describe("preroll policy", () => {
  it("returns no opportunity when advertising is disabled", () => {
    expect(decidePreroll({ consent: "PERSONALIZED", provider: { kind: "disabled" } })).toEqual({
      allowed: false,
      reason: "DISABLED",
    });
  });

  it.each([
    ["UNKNOWN", "CONSENT_UNKNOWN"],
    ["DENIED", "CONSENT_DENIED"],
  ] as const)("returns no opportunity for %s consent", (consent, reason) => {
    expect(decidePreroll({ consent, provider })).toEqual({ allowed: false, reason });
  });

  it("returns one non-personalized fixture preroll for limited consent", () => {
    expect(decidePreroll({ consent: "NON_PERSONALIZED", provider })).toEqual({
      allowed: true,
      opportunity: {
        fixtureScenario: "completed",
        personalized: false,
        placement: "preroll",
        provider: "google-ima",
        tagUrl: "https://pubads.g.doubleclick.net/gampad/ads?iu=test&npa=1",
      },
    });
  });

  it("returns one personalized preroll without adding fixture metadata", () => {
    const consent: AdvertisingConsentState = "PERSONALIZED";

    expect(
      decidePreroll({
        consent,
        provider: {
          kind: "google-ima",
          nonPersonalizedTagUrl: "https://pubads.g.doubleclick.net/gampad/ads?npa=1",
          personalizedTagUrl: "https://pubads.g.doubleclick.net/gampad/ads",
        },
      }),
    ).toEqual({
      allowed: true,
      opportunity: {
        personalized: true,
        placement: "preroll",
        provider: "google-ima",
        tagUrl: "https://pubads.g.doubleclick.net/gampad/ads",
      },
    });
  });
});
