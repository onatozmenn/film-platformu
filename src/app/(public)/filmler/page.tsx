import type { Metadata } from "next";

import { CatalogScreen, catalogQueries, parseCatalogFilters } from "@/modules/catalog";
import type { CatalogSearchParams } from "@/modules/catalog";

export const metadata: Metadata = {
  title: "Filmler",
  description: "Film Platform seçkisindeki filmleri tür ve yıla göre keşfedin.",
};

export default async function CatalogPage({
  searchParams,
}: Readonly<{ searchParams: Promise<CatalogSearchParams> }>) {
  const filters = parseCatalogFilters(await searchParams);
  const view = await catalogQueries.listMovies(filters);

  return <CatalogScreen filters={filters} view={view} />;
}
