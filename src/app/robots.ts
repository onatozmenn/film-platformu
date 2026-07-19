import type { MetadataRoute } from "next";

import { getServerEnvironment } from "@/shared/config/server-environment";

export default function robots(): MetadataRoute.Robots {
  const { siteOrigin } = getServerEnvironment();
  return {
    rules: {
      allow: "/",
      disallow: ["/api/", "/giris", "/hesap", "/izle/", "/yonetim/"],
      userAgent: "*",
    },
    sitemap: `${siteOrigin}/sitemap.xml`,
  };
}
