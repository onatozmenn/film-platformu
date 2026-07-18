export type AdvertisingConsentState = "DENIED" | "NON_PERSONALIZED" | "PERSONALIZED" | "UNKNOWN";

export type AdvertisingFixtureScenario = "blocked" | "completed" | "empty" | "error" | "timeout";

export type PrerollProviderConfiguration =
  | Readonly<{ kind: "disabled" }>
  | Readonly<{
      fixtureScenario?: AdvertisingFixtureScenario;
      kind: "google-ima";
      nonPersonalizedTagUrl: string;
      personalizedTagUrl: string;
    }>;

export type PrerollOpportunity = Readonly<{
  fixtureScenario?: AdvertisingFixtureScenario;
  personalized: boolean;
  placement: "preroll";
  provider: "google-ima";
  tagUrl: string;
}>;

export type PrerollDecision =
  | Readonly<{ allowed: false; reason: "CONSENT_DENIED" | "CONSENT_UNKNOWN" | "DISABLED" }>
  | Readonly<{ allowed: true; opportunity: PrerollOpportunity }>;

export function decidePreroll(
  input: Readonly<{
    consent: AdvertisingConsentState;
    provider: PrerollProviderConfiguration;
  }>,
): PrerollDecision {
  if (input.provider.kind === "disabled") {
    return { allowed: false, reason: "DISABLED" };
  }
  if (input.consent === "UNKNOWN") {
    return { allowed: false, reason: "CONSENT_UNKNOWN" };
  }
  if (input.consent === "DENIED") {
    return { allowed: false, reason: "CONSENT_DENIED" };
  }

  return {
    allowed: true,
    opportunity: {
      ...(input.provider.fixtureScenario === undefined
        ? {}
        : { fixtureScenario: input.provider.fixtureScenario }),
      personalized: input.consent === "PERSONALIZED",
      placement: "preroll",
      provider: "google-ima",
      tagUrl:
        input.consent === "PERSONALIZED"
          ? input.provider.personalizedTagUrl
          : input.provider.nonPersonalizedTagUrl,
    },
  };
}
