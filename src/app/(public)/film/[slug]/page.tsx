import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { MovieDetailScreen, parseMovieSlug } from "@/modules/catalog";
import { catalogQueries } from "@/modules/catalog/server";
import { getOptionalMemberSession } from "@/modules/identity/server";
import { libraryService } from "@/modules/library/server";
import { MemberLibraryControls } from "@/modules/library/ui/member-library-controls";
import { playbackService, territoryResolver } from "@/modules/playback/server";

type MoviePageProps = Readonly<{ params: Promise<{ slug: string }> }>;

export async function generateMetadata({ params }: MoviePageProps): Promise<Metadata> {
  const slug = parseMovieSlug((await params).slug);
  const movie = slug === null ? null : await catalogQueries.getMovieBySlug(slug);

  if (movie === null) {
    notFound();
  }

  return { title: movie.title, description: movie.synopsis };
}

export default async function MoviePage({ params }: MoviePageProps) {
  const slug = parseMovieSlug((await params).slug);

  if (slug === null) {
    notFound();
  }

  const movie = await catalogQueries.getMovieBySlug(slug);

  if (movie === null) {
    notFound();
  }

  const territory = territoryResolver.resolve(await headers());
  const [availability, session] = await Promise.all([
    playbackService.inspectAvailability(movie.id, territory),
    getOptionalMemberSession(),
  ]);
  const memberState =
    session === null
      ? null
      : await libraryService.getMovieState({
          actorUserId: session.user.id,
          movieId: movie.id,
          ownerUserId: session.user.id,
        });

  return (
    <MovieDetailScreen
      memberActions={<MemberLibraryControls initialState={memberState} movieId={movie.id} />}
      movie={{ ...movie, isPlayable: availability.available }}
    />
  );
}
