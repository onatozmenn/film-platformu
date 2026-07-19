import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { parseAdminRouteId } from "@/modules/admin/http/admin-route-id";
import { adminQueries } from "@/modules/admin/server";
import { MovieDetailScreen } from "@/modules/catalog";
import { getOptionalMemberSession } from "@/modules/identity/server";

export const metadata: Metadata = { title: "Film Önizleme" };

export default async function AdminMoviePreview({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const movieId = parseAdminRouteId((await params).id);
  if (movieId === null) {
    notFound();
  }
  const session = await getOptionalMemberSession();
  if (session === null) {
    redirect("/giris");
  }
  const movie = await adminQueries.getPreview(session.user.id, movieId);
  if (movie === null) {
    notFound();
  }
  return (
    <div className="admin-preview" id="ana-icerik">
      <div className="admin-preview-banner">
        <strong>Önizleme</strong>
        <span>Bu görünüm ortak katalogda yayınlanmaz.</span>
      </div>
      <MovieDetailScreen movie={movie} />
    </div>
  );
}
