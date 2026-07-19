import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ConsentAwareWatchPlayer } from "@/modules/advertising/ui/consent-aware-watch-player";
import { parseMovieSlug } from "@/modules/catalog";
import { catalogQueries } from "@/modules/catalog/server";
import { getOptionalMemberSession } from "@/modules/identity/server";
import { libraryService } from "@/modules/library/server";
import { MemberLibraryControls } from "@/modules/library/ui/member-library-controls";
import { WatchScreen } from "@/modules/playback/ui/watch-screen";
import { parsePublicEnvironment } from "@/shared/config/public-environment";

type WatchPageProps = Readonly<{ params: Promise<{ slug: string }> }>;

export async function generateMetadata({ params }: WatchPageProps): Promise<Metadata> {
  const slug = parseMovieSlug((await params).slug);
  const movie = slug === null ? null : await catalogQueries.getMovieBySlug(slug);
  if (movie === null) {
    notFound();
  }
  return { title: `${movie.title} izle`, description: movie.synopsis };
}

export default async function WatchPage({ params }: WatchPageProps) {
  const slug = parseMovieSlug((await params).slug);
  const movie = slug === null ? null : await catalogQueries.getMovieBySlug(slug);
  if (movie === null) {
    notFound();
  }
  const { siteName } = parsePublicEnvironment({
    NEXT_PUBLIC_SITE_NAME: process.env.NEXT_PUBLIC_SITE_NAME,
  });
  const session = await getOptionalMemberSession();
  const memberState =
    session === null
      ? null
      : await libraryService.getMovieState({
          actorUserId: session.user.id,
          movieId: movie.id,
          ownerUserId: session.user.id,
        });

  return (
    <WatchScreen
      accountHref={session === null ? "/giris" : "/hesap"}
      accountLabel={session === null ? "Oturum aç" : session.user.displayName}
      memberActions={<MemberLibraryControls initialState={memberState} movieId={movie.id} />}
      movie={{
        ageRating: movie.ageRating,
        id: movie.id,
        runtimeMinutes: movie.runtimeMinutes,
        slug: movie.slug,
        synopsis: movie.synopsis,
        title: movie.title,
        year: movie.year,
      }}
      player={
        <ConsentAwareWatchPlayer
          key={movie.id}
          movieId={movie.id}
          progressMode={session === null ? "guest" : "member"}
          title={movie.title}
        />
      }
      siteName={siteName}
    />
  );
}
