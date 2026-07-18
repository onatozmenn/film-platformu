import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MovieDetailScreen, parseMovieSlug } from "@/modules/catalog";
import { catalogQueries } from "@/modules/catalog/server";

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

  return <MovieDetailScreen movie={movie} />;
}
