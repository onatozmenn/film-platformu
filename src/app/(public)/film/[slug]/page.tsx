import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { MovieDetailScreen, parseMovieSlug } from "@/modules/catalog";
import { catalogQueries } from "@/modules/catalog/server";
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
  const availability = await playbackService.inspectAvailability(movie.id, territory);

  return <MovieDetailScreen movie={{ ...movie, isPlayable: availability.available }} />;
}
