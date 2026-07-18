import type { Metadata } from "next";

import { SearchScreen, catalogQueries, normalizeSearchQuery } from "@/modules/catalog";

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
  const view =
    queryState.kind === "valid" ? await catalogQueries.searchMovies(queryState.query) : null;

  return <SearchScreen queryState={queryState} view={view} />;
}
