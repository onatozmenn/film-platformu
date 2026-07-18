import "server-only";

import { createFixedWindowRateLimiter } from "@/shared/http/fixed-window-rate-limiter";

import { createAdvertisingService } from "./application/create-advertising-service";
import { parseAdvertisingEnvironment } from "./infrastructure/advertising-environment";
import { createPrerollProviderConfiguration } from "./infrastructure/fake-preroll-provider";
import { createTestConsentResolver } from "./infrastructure/test-consent-resolver";

const environment = parseAdvertisingEnvironment({
  ADVERTISING_PROVIDER: process.env.ADVERTISING_PROVIDER,
  ADVERTISING_TEST_SCENARIO: process.env.ADVERTISING_TEST_SCENARIO,
  NODE_ENV: process.env.NODE_ENV,
});

export const advertisingService = createAdvertisingService({
  consentResolver: createTestConsentResolver(environment),
  provider: createPrerollProviderConfiguration(environment),
});

export const advertisingOutcomeRateLimiter = createFixedWindowRateLimiter(40, 60_000);
