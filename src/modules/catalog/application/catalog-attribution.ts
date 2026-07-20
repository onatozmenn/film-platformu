import openFilmCatalog from "@/content/open-film-catalog.json";

import { parseOpenFilmManifest } from "./open-film-manifest";

export type CatalogAttribution = Readonly<{
  copyrightNotice: string;
  creator: string;
  licenseLabel: string;
  licenseUrl: string;
  notice: string;
  sourceUrl: string;
}>;

const attributions: Readonly<Record<string, CatalogAttribution>> = Object.fromEntries(
  parseOpenFilmManifest(openFilmCatalog).films.map((film) => [
    film.slug,
    {
      copyrightNotice: film.license.copyrightNotice,
      creator: film.license.creator,
      licenseLabel: film.license.label,
      licenseUrl: film.license.url,
      notice: film.license.notice,
      sourceUrl: film.video.sourceUrl,
    },
  ]),
);

export function getCatalogAttribution(slug: string): CatalogAttribution | null {
  return attributions[slug] ?? null;
}
