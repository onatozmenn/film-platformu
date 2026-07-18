import { formatNumber } from "@/shared/i18n/formatters";

import type { SearchPageView } from "../application/catalog-query-port";
import { createSearchHref, type SearchQueryState } from "../application/search-query";
import { MoviePosterItem } from "./movie-poster-item";
import { PaginationNav } from "./pagination-nav";
import { SearchCombobox } from "./search-combobox";

export function SearchScreen({
  queryState,
  view,
}: Readonly<{ queryState: SearchQueryState; view: SearchPageView | null }>) {
  return (
    <main className="search-page" id="ana-icerik">
      <div className="search-page__inner">
        <header>
          <p className="eyebrow">Katalog araması</p>
          <h1>Arama</h1>
        </header>
        <SearchCombobox initialQuery={queryState.query} />

        {queryState.kind === "blank" ? null : queryState.kind === "too-short" ? (
          <p className="search-guidance">Aramak için en az 2 karakter girin.</p>
        ) : queryState.kind === "too-long" ? (
          <p className="search-guidance">Arama en fazla 80 karakter olabilir.</p>
        ) : view === null || view.movies.length === 0 ? (
          <section className="search-empty" aria-labelledby="search-empty-title">
            <h2 id="search-empty-title">“{queryState.query}” için sonuç bulunamadı</h2>
            <p>Başka bir film adı, özgün ad veya oyuncu adı deneyin.</p>
          </section>
        ) : (
          <section aria-labelledby="search-results-title">
            <div className="search-results-heading">
              <h2 id="search-results-title">“{queryState.query}” sonuçları</h2>
              <p aria-live="polite">{formatNumber(view.total)} film</p>
            </div>
            <div className="catalog-grid">
              {view.movies.map((movie, index) => (
                <MoviePosterItem eager={index === 0} movie={movie} key={movie.id} />
              ))}
            </div>
            <PaginationNav
              hrefForPage={(page) => createSearchHref(queryState.query, page)}
              pageInfo={view.pageInfo}
            />
          </section>
        )}
      </div>
    </main>
  );
}
