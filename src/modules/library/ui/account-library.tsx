import Link from "next/link";

import { MoviePosterItem } from "@/modules/catalog/ui/movie-poster-item";

import type { MemberLibraryView } from "../application/library-ports";
import { ClearHistoryButton } from "./clear-history-button";

export function AccountLibrary({ library }: Readonly<{ library: MemberLibraryView }>) {
  return (
    <div className="account-library">
      <section className="account-library__band" aria-labelledby="continue-watching-title">
        <div className="account-library__heading">
          <div>
            <p className="eyebrow">Kaldığınız yer</p>
            <h2 id="continue-watching-title">İzlemeye devam et</h2>
          </div>
          {library.continueWatching.length === 0 ? null : <ClearHistoryButton />}
        </div>
        {library.continueWatching.length === 0 ? (
          <div className="account-library__empty">
            <p>Yarım bıraktığınız filmler burada görünür.</p>
            <Link className="ghost-action" href="/filmler">
              Filmlere göz at
            </Link>
          </div>
        ) : (
          <div className="catalog-grid account-library__grid">
            {library.continueWatching.map(({ movie, progressPercent }, index) => (
              <MoviePosterItem
                eager={index < 2}
                href={`/izle/${movie.slug}`}
                key={movie.id}
                movie={movie}
                progressPercent={progressPercent}
              />
            ))}
          </div>
        )}
      </section>

      <section className="account-library__band" aria-labelledby="watchlist-title">
        <div className="account-library__heading">
          <div>
            <p className="eyebrow">Kaydedilenler</p>
            <h2 id="watchlist-title">İzleme listem</h2>
          </div>
        </div>
        {library.watchlist.length === 0 ? (
          <div className="account-library__empty">
            <p>Listenizde henüz film yok.</p>
            <Link className="ghost-action" href="/filmler">
              Seçkiyi keşfet
            </Link>
          </div>
        ) : (
          <div className="catalog-grid account-library__grid">
            {library.watchlist.map((movie, index) => (
              <MoviePosterItem eager={index < 2} key={movie.id} movie={movie} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
