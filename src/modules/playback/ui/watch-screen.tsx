import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export type WatchMovieView = Readonly<{
  ageRating: string | null;
  id: string;
  runtimeMinutes: number;
  slug: string;
  synopsis: string;
  title: string;
  year: number;
}>;

export function WatchScreen({
  accountHref,
  accountLabel,
  memberActions,
  movie,
  player,
  siteName,
}: Readonly<{
  accountHref: string;
  accountLabel: string;
  memberActions?: ReactNode;
  movie: WatchMovieView;
  player: ReactNode;
  siteName: string;
}>) {
  return (
    <>
      <a className="skip-link" href="#ana-icerik">
        Ana içeriğe geç
      </a>
      <header className="watch-header">
        <Link className="brand" href="/" aria-label={`${siteName} ana sayfa`}>
          <span className="brand__cue" aria-hidden="true" />
          <span>{siteName}</span>
        </Link>
        <nav className="watch-header__actions" aria-label="İzleme menüsü">
          <Link className="watch-back-link" href={`/film/${movie.slug}`}>
            <ArrowLeft aria-hidden="true" size={18} strokeWidth={2} />
            Film detayına dön
          </Link>
          <Link className="watch-account-link" href={accountHref}>
            {accountLabel}
          </Link>
        </nav>
      </header>

      <main className="watch-page" id="ana-icerik">
        <section className="watch-theater" aria-label={`${movie.title} oynatıcı`}>
          {player}
        </section>
        <section className="watch-information" aria-labelledby="watch-title">
          <p className="eyebrow">Şimdi gösterimde</p>
          <h1 id="watch-title">{movie.title}</h1>
          <p className="watch-information__metadata">
            <span>{movie.year}</span>
            <span>{movie.runtimeMinutes} dk.</span>
            {movie.ageRating === null ? null : <span>{movie.ageRating}</span>}
          </p>
          {memberActions}
          <p className="watch-information__synopsis">{movie.synopsis}</p>
        </section>
      </main>
    </>
  );
}
