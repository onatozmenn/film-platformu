import Image from "next/image";
import Link from "next/link";

import { formatNumber } from "@/shared/i18n/formatters";

import type { MovieDetailView } from "../application/catalog-query-port";
import { MoviePosterItem } from "./movie-poster-item";

export function MovieDetailScreen({ movie }: Readonly<{ movie: MovieDetailView }>) {
  const usesLongTitle = movie.title.length > 50;

  return (
    <main id="ana-icerik">
      <header
        className={
          movie.backdrop === null ? "detail-header detail-header--fallback" : "detail-header"
        }
      >
        {movie.backdrop === null ? null : (
          <Image
            alt=""
            className="detail-header__image"
            fill
            loading="eager"
            sizes="100vw"
            src={movie.backdrop.src}
            style={{ objectPosition: movie.backdrop.focalPosition }}
          />
        )}
        <span className="detail-header__overlay" aria-hidden="true" />
        <div className="detail-header__inner">
          <p className="eyebrow">Film seçkisi</p>
          <h1 className={usesLongTitle ? "detail-title detail-title--long" : "detail-title"}>
            {movie.title}
          </h1>
          <p className="detail-header__metadata">
            {movie.originalTitle === null ? null : <span>{movie.originalTitle}</span>}
            <span>{movie.year}</span>
            <span>{movie.runtimeMinutes} dk.</span>
            {movie.ageRating === null ? null : (
              <span className="metadata-badge">{movie.ageRating}</span>
            )}
            <span>{movie.genres.join(" · ")}</span>
          </p>
          {movie.isPlayable ? (
            <Link className="primary-action" href={`/izle/${movie.slug}`}>
              İzle
            </Link>
          ) : (
            <p className="availability-note">Bu film şu anda oynatılamıyor.</p>
          )}
        </div>
      </header>

      <section className="detail-body" aria-labelledby="synopsis-heading">
        <div className="detail-poster">
          {movie.poster === null ? (
            <span aria-hidden="true">
              {movie.title
                .split(" ")
                .slice(0, 2)
                .map((word) => word.at(0))
                .join("")}
            </span>
          ) : (
            <Image
              alt={movie.poster.alt}
              fill
              loading="eager"
              sizes="(max-width: 767px) 240px, 240px"
              src={movie.poster.src}
              style={{ objectPosition: movie.poster.focalPosition }}
            />
          )}
        </div>
        <div className="detail-reading">
          <h2 id="synopsis-heading">Film hakkında</h2>
          <p className="detail-synopsis">{movie.synopsis}</p>

          {movie.credits.length === 0 ? null : (
            <dl className="credit-list">
              {movie.credits.map((group) => (
                <div key={group.label}>
                  <dt>{group.label}</dt>
                  <dd>{group.names.join(", ")}</dd>
                </div>
              ))}
            </dl>
          )}

          {movie.rating === null ? null : (
            <p className="rating-summary">
              <strong>{formatNumber(movie.rating.average)} / 5</strong>
              <span>{formatNumber(movie.rating.count)} değerlendirme</span>
            </p>
          )}

          {movie.subtitleLanguages.length === 0 ? null : (
            <p className="subtitle-summary">
              <strong>Altyazılar</strong>
              <span>{movie.subtitleLanguages.join(", ")}</span>
            </p>
          )}
        </div>
      </section>

      {movie.similarMovies.length === 0 ? null : (
        <section className="catalog-section" aria-labelledby="similar-movies">
          <div className="catalog-section__inner">
            <div className="catalog-section__heading">
              <h2 id="similar-movies">Benzer filmler</h2>
            </div>
            <div className="film-rail">
              {movie.similarMovies.map((similar, index) => (
                <MoviePosterItem eager={index === 0} movie={similar} key={similar.id} />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
