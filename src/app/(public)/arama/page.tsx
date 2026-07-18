import type { Metadata } from "next";

import { SearchScreen, normalizeSearchQuery } from "@/modules/catalog";
import { catalogQueries } from "@/modules/catalog/server";
import { parsePageNumber } from "@/shared/pagination/page";

export const metadata: Metadata = {
  title: "Arama",
  description: "Film Platform seçkisinde film ve kişi arayın.",
};

export default async function SearchPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const queryState = normalizeSearchQuery(rawQuery);
  const page = parsePageNumber(params.sayfa);
  const view =
    queryState.kind === "valid" ? await catalogQueries.searchMovies(queryState.query, page) : null;

  return <SearchScreen queryState={queryState} view={view} />;
}
