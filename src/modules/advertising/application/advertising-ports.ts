import type { AdvertisingConsentState } from "../domain/preroll-policy";

export interface AdvertisingConsentResolverPort {
  resolve(headers: Headers): AdvertisingConsentState;
}
