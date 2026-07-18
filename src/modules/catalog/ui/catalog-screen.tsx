import Link from "next/link";

import { formatNumber } from "@/shared/i18n/formatters";

import { createCatalogHref } from "../application/catalog-filters";
import type { CatalogFilters, CatalogPageView } from "../application/catalog-query-port";
import { CatalogFilterControls } from "./catalog-filter-controls";
import { MoviePosterItem } from "./movie-poster-item";

export function CatalogScreen({
  filters,
  view,
}: Readonly<{ filters: CatalogFilters; view: CatalogPageView }>) {
  const activeGenre = view.availableGenres.find((genre) => genre.slug === filters.genre);

  return (
    <main className="catalog-page" id="ana-icerik">
      <div className="catalog-page__inner">
        <header className="catalog-page__heading">
          <div>
            <p className="eyebrow">Film programı</p>
            <h1>Filmler</h1>
          </div>
          <p aria-live="polite">{formatNumber(view.total)} sonuç</p>
        </header>

        <CatalogFilterControls
          availableGenres={view.availableGenres}
          availableYears={view.availableYears}
          filters={filters}
        />

        {activeGenre === undefined && filters.year === null ? null : (
          <div className="active-filters" aria-label="Etkin filtreler">
            {activeGenre === undefined ? null : (
              <Link
                href={createCatalogHref(filters, { genre: null })}
                aria-label={`${activeGenre.name} filtresini kaldır`}
              >
                {activeGenre.name}
                <span aria-hidden="true"> ×</span>
                <span className="visually-hidden"> filtresini kaldır</span>
              </Link>
            )}
            {filters.year === null ? null : (
              <Link
                href={createCatalogHref(filters, { year: null })}
                aria-label={`${filters.year} yılı filtresini kaldır`}
              >
                {filters.year}
                <span aria-hidden="true"> ×</span>
                <span className="visually-hidden"> yılı filtresini kaldır</span>
              </Link>
            )}
          </div>
        )}

        {view.movies.length === 0 ? (
          <section className="catalog-empty" aria-labelledby="catalog-empty-title">
            <h2 id="catalog-empty-title">Bu filtrelerle eşleşen film yok</h2>
            <p>Etkin filtreleri temizleyerek seçkinin tamamına dönebilirsiniz.</p>
            <Link className="primary-action" href="/filmler">
              Filtreleri temizle
            </Link>
          </section>
        ) : (
          <div className="catalog-grid">
            {view.movies.map((movie, index) => (
              <MoviePosterItem eager={index === 0} movie={movie} key={movie.id} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
