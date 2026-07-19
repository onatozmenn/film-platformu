import type { MetadataRoute } from "next";

import { catalogQueries } from "@/modules/catalog/server";
import {
  approvedFooterLinks,
  approvedPublicContent,
} from "@/modules/compliance/approved-public-content";
import { getServerEnvironment } from "@/shared/config/server-environment";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { siteOrigin } = getServerEnvironment();
  const filters = {
    genre: null,
    page: 1,
    sort: "editor-secimi",
    year: null,
  } as const;
  const firstPage = await catalogQueries.listMovies(filters);
  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.pageInfo.totalPages - 1 }, (_, index) =>
      catalogQueries.listMovies({ ...filters, page: index + 2 }),
    ),
  );
  const movies = [firstPage, ...remainingPages].flatMap((page) => page.movies);

  return [
    { changeFrequency: "daily", priority: 1, url: `${siteOrigin}/` },
    { changeFrequency: "daily", priority: 0.9, url: `${siteOrigin}/filmler` },
    ...approvedFooterLinks(approvedPublicContent).map((link) => ({
      changeFrequency: "yearly" as const,
      priority: 0.2,
      url: `${siteOrigin}${link.href}`,
    })),
    ...movies.map((movie) => ({
      changeFrequency: "weekly" as const,
      priority: 0.8,
      url: `${siteOrigin}/film/${movie.slug}`,
    })),
  ];
}
