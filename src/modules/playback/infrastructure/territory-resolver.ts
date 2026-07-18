import type { ServerEnvironment } from "@/shared/config/server-environment-schema";

import type { TerritoryResolverPort } from "../application/playback-ports";

const vercelCountryHeader = "x-vercel-ip-country";

export function createTerritoryResolver(
  config: ServerEnvironment["playback"],
  trustedVercelDeployment: boolean,
): TerritoryResolverPort {
  const supported = new Set(config.supportedTerritories);

  return {
    resolve(headers) {
      if (trustedVercelDeployment) {
        const country = headers.get(vercelCountryHeader)?.trim().toUpperCase();
        if (country !== undefined && /^[A-Z]{2}$/u.test(country) && supported.has(country)) {
          return country;
        }
      }

      return config.localDefaultTerritory;
    },
  };
}
