import { describe, expect, it } from "vitest";

import type { AdvertisingEnvironment } from "./advertising-environment";
import { advertisingTestConsentHeader, createTestConsentResolver } from "./test-consent-resolver";

const fakeEnvironment: AdvertisingEnvironment = {
  nodeEnvironment: "test",
  provider: { fixtureScenario: "completed", kind: "fake" },
};

describe("test consent resolver", () => {
  it.each(["DENIED", "NON_PERSONALIZED", "PERSONALIZED", "UNKNOWN"] as const)(
    "accepts the owned %s state only for the non-production fake",
    (consent) => {
      const headers = new Headers({ [advertisingTestConsentHeader]: consent });

      expect(createTestConsentResolver(fakeEnvironment).resolve(headers)).toBe(consent);
    },
  );

  it("maps missing and invalid test state to unknown", () => {
    const resolver = createTestConsentResolver(fakeEnvironment);

    expect(resolver.resolve(new Headers())).toBe("UNKNOWN");
    expect(resolver.resolve(new Headers({ [advertisingTestConsentHeader]: "personalized" }))).toBe(
      "UNKNOWN",
    );
  });

  it("ignores the test header when advertising is disabled or production-like", () => {
    const headers = new Headers({ [advertisingTestConsentHeader]: "PERSONALIZED" });

    expect(
      createTestConsentResolver({
        nodeEnvironment: "test",
        provider: { kind: "disabled" },
      }).resolve(headers),
    ).toBe("UNKNOWN");
    expect(
      createTestConsentResolver({ ...fakeEnvironment, nodeEnvironment: "production" }).resolve(
        headers,
      ),
    ).toBe("UNKNOWN");
  });
});
