import Image from "next/image";
import Link from "next/link";

import { formatNumber } from "@/shared/i18n/formatters";

import type { MovieCardView } from "../application/catalog-query-port";

export function MoviePosterItem({
  eager = false,
  movie,
  rank,
}: Readonly<{ eager?: boolean; movie: MovieCardView; rank?: number }>) {
  const initials = movie.title
    .split(" ")
    .slice(0, 2)
    .map((word) => word.at(0))
    .join("");

  return (
    <article className={rank === undefined ? "poster-item" : "poster-item poster-item--ranked"}>
      {rank === undefined ? null : (
        <span className="poster-item__rank" aria-hidden="true">
          {rank}
        </span>
      )}
      <Link
        aria-label={rank === undefined ? undefined : `${rank}. sırada ${movie.title}`}
        className="poster-item__link"
        href={`/film/${movie.slug}`}
      >
        <div className="poster-item__media">
          {movie.poster === null ? (
            <span className="poster-item__placeholder" aria-hidden="true">
              {initials}
            </span>
          ) : (
            <Image
              alt={movie.poster.alt}
              fill
              loading={eager ? "eager" : "lazy"}
              sizes="(max-width: 479px) 46vw, (max-width: 767px) 30vw, (max-width: 1023px) 23vw, 176px"
              src={movie.poster.src}
              style={{ objectPosition: movie.poster.focalPosition }}
            />
          )}
        </div>
        <p className="poster-item__title">{movie.title}</p>
        <p className="poster-item__meta">
          {movie.year}
          {movie.rating === null ? null : ` · ${formatNumber(movie.rating.average)} / 5`}
        </p>
      </Link>
    </article>
  );
}
