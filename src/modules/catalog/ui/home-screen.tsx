import Image from "next/image";
import Link from "next/link";

import type { HomePageView } from "../application/catalog-query-port";
import { MovieRail } from "./movie-rail";

export function HomeScreen({ view }: Readonly<{ view: HomePageView }>) {
  return (
    <main id="ana-icerik">
      <section className="hero-fallback" aria-labelledby="featured-title">
        {view.featured.backdrop === null ? null : (
          <Image
            alt={view.featured.backdrop.alt}
            className="hero-fallback__image"
            fill
            preload
            sizes="100vw"
            src={view.featured.backdrop.src}
            style={{ objectPosition: view.featured.backdrop.focalPosition }}
          />
        )}
        <span className="hero-fallback__overlay" aria-hidden="true" />
        <div className="hero-fallback__inner">
          <p className="eyebrow">Film Platform seçkisi</p>
          <h1 id="featured-title">{view.featured.title}</h1>
          <p className="hero-fallback__metadata">
            <span>{view.featured.year}</span>
            <span>{view.featured.runtimeMinutes} dk.</span>
            {view.featured.ageRating === null ? null : (
              <span className="metadata-badge">{view.featured.ageRating}</span>
            )}
            <span>{view.featured.genres.join(" · ")}</span>
          </p>
          <p className="hero-fallback__synopsis">{view.featured.synopsis}</p>
          <div className="hero-fallback__actions">
            <Link className="primary-action" href={`/film/${view.featured.slug}`}>
              Detayları gör
            </Link>
            <Link className="secondary-action" href="/filmler">
              Tüm filmler
            </Link>
          </div>
        </div>
      </section>

      {view.rails.map((rail) => (
        <MovieRail key={rail.id} rail={rail} />
      ))}
    </main>
  );
}
