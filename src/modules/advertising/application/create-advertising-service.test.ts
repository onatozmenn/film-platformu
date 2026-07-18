import { describe, expect, it, vi } from "vitest";

import type { AdvertisingConsentResolverPort } from "./advertising-ports";
import { createAdvertisingService } from "./create-advertising-service";

describe("advertising service", () => {
  it("returns no opportunity when owned consent is unknown", () => {
    const consentResolver: AdvertisingConsentResolverPort = {
      resolve: vi.fn<AdvertisingConsentResolverPort["resolve"]>(() => "UNKNOWN"),
    };
    const service = createAdvertisingService({
      consentResolver,
      provider: { kind: "disabled" },
    });

    expect(service.resolvePreroll(new Headers())).toBeNull();
    expect(consentResolver.resolve).toHaveBeenCalledOnce();
  });

  it("returns the single non-personalized provider configuration", () => {
    const service = createAdvertisingService({
      consentResolver: { resolve: () => "NON_PERSONALIZED" },
      provider: {
        fixtureScenario: "completed",
        kind: "google-ima",
        nonPersonalizedTagUrl: "https://pubads.g.doubleclick.net/gampad/ads?npa=1",
        personalizedTagUrl: "https://pubads.g.doubleclick.net/gampad/ads",
      },
    });

    expect(service.resolvePreroll(new Headers())).toEqual({
      fixtureScenario: "completed",
      personalized: false,
      placement: "preroll",
      provider: "google-ima",
      tagUrl: "https://pubads.g.doubleclick.net/gampad/ads?npa=1",
    });
  });
});
