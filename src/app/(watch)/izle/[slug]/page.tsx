import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { parseMovieSlug } from "@/modules/catalog";
import { catalogQueries } from "@/modules/catalog/server";
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

  return (
    <WatchScreen
      movie={{
        ageRating: movie.ageRating,
        id: movie.id,
        runtimeMinutes: movie.runtimeMinutes,
        slug: movie.slug,
        synopsis: movie.synopsis,
        title: movie.title,
        year: movie.year,
      }}
      siteName={siteName}
    />
  );
}
