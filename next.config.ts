import type { NextConfig } from "next";

import { parseSecurityHeadersEnvironment } from "./src/shared/config/security-headers-environment";
import { buildSecurityHeaders } from "./src/shared/config/security-headers";

const securityHeaders = buildSecurityHeaders(
  parseSecurityHeadersEnvironment({
    NODE_ENV: process.env.NODE_ENV,
    PRODUCTION_CSP_ENFORCED: process.env.PRODUCTION_CSP_ENFORCED,
    PRODUCTION_HSTS_ENABLED: process.env.PRODUCTION_HSTS_ENABLED,
    RELEASE_ID: process.env.RELEASE_ID,
    SITE_ORIGIN: process.env.SITE_ORIGIN,
  }),
);

const nextConfig: NextConfig = {
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
