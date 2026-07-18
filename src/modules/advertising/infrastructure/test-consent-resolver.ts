import { z } from "zod";

import type { AdvertisingConsentResolverPort } from "../application/advertising-ports";
import type { AdvertisingEnvironment } from "./advertising-environment";

export const advertisingTestConsentHeader = "x-film-test-consent";

const consentStateSchema = z.enum(["DENIED", "NON_PERSONALIZED", "PERSONALIZED", "UNKNOWN"]);

export function createTestConsentResolver(
  environment: AdvertisingEnvironment,
): AdvertisingConsentResolverPort {
  return {
    resolve(headers) {
      if (environment.nodeEnvironment === "production" || environment.provider.kind !== "fake") {
        return "UNKNOWN";
      }

      const parsed = consentStateSchema.safeParse(headers.get(advertisingTestConsentHeader));
      return parsed.success ? parsed.data : "UNKNOWN";
    },
  };
}
