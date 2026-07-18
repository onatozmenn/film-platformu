import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MovieDetailScreen, catalogQueries, parseMovieSlug } from "@/modules/catalog";

type MoviePageProps = Readonly<{ params: Promise<{ slug: string }> }>;

export async function generateMetadata({ params }: MoviePageProps): Promise<Metadata> {
  const slug = parseMovieSlug((await params).slug);
  const movie = slug === null ? null : await catalogQueries.getMovieBySlug(slug);

  return movie === null
    ? { title: "Film bulunamadı" }
    : { title: movie.title, description: movie.synopsis };
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
