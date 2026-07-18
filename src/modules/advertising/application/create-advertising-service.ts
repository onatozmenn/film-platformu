import type { AdvertisingConsentResolverPort } from "./advertising-ports";
import { decidePreroll, type PrerollProviderConfiguration } from "../domain/preroll-policy";

type CreateAdvertisingServiceDependencies = Readonly<{
  consentResolver: AdvertisingConsentResolverPort;
  provider: PrerollProviderConfiguration;
}>;

export function createAdvertisingService(dependencies: CreateAdvertisingServiceDependencies) {
  return {
    resolvePreroll(headers: Headers) {
      const decision = decidePreroll({
        consent: dependencies.consentResolver.resolve(headers),
        provider: dependencies.provider,
      });
      return decision.allowed ? decision.opportunity : null;
    },
  };
}
