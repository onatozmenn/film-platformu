import type { PrerollProviderConfiguration } from "../domain/preroll-policy";
import type { AdvertisingEnvironment } from "./advertising-environment";

const googleImaSampleTag = "https://pubads.g.doubleclick.net/gampad/ads";

function createSampleTag(nonPersonalized: boolean): string {
  const tag = new URL(googleImaSampleTag);
  tag.searchParams.set("iu", "/21775744923/external/single_ad_samples");
  tag.searchParams.set("sz", "640x480");
  tag.searchParams.set("cust_params", "sample_ct=linear");
  tag.searchParams.set("ciu_szs", "300x250");
  tag.searchParams.set("gdfp_req", "1");
  tag.searchParams.set("output", "vast");
  tag.searchParams.set("unviewed_position_start", "1");
  tag.searchParams.set("env", "vp");
  tag.searchParams.set("impl", "s");
  tag.searchParams.set("correlator", "");
  if (nonPersonalized) {
    tag.searchParams.set("npa", "1");
  }
  return tag.toString();
}

export function createPrerollProviderConfiguration(
  environment: AdvertisingEnvironment,
): PrerollProviderConfiguration {
  if (environment.provider.kind === "disabled") {
    return { kind: "disabled" };
  }

  return {
    fixtureScenario: environment.provider.fixtureScenario,
    kind: "google-ima",
    nonPersonalizedTagUrl: createSampleTag(true),
    personalizedTagUrl: createSampleTag(false),
  };
}
