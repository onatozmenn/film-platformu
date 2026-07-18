import type { MetadataProviderEnvironment } from "@/shared/config/server-environment-schema";

import type { MetadataProviderPort } from "../application/metadata-provider-port";
import { disabledMetadataProvider } from "./disabled-metadata-provider";
import { createTmdbMetadataProvider, type FetchImplementation } from "./tmdb-metadata-provider";

export function createMetadataProvider(
  config: MetadataProviderEnvironment,
  dependencies: Readonly<{
    fetchImplementation?: FetchImplementation;
    timeoutMs?: number;
  }> = {},
): MetadataProviderPort {
  if (config.kind === "disabled") {
    return disabledMetadataProvider;
  }

  return createTmdbMetadataProvider({ apiToken: config.apiToken, ...dependencies });
}
